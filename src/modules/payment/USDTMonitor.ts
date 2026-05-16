import axios from "axios";
import { getLogger } from "../../config/logger";
import * as crypto from "crypto";

const logger = getLogger();

// TronGrid API constants
const TRONGRID_API = "https://api.trongrid.io";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6;

export interface USDTTransaction {
  txId: string
  from: string
  to: string
  amount: number
  timestamp: number
  confirmed: boolean
}

export interface DonationRecord {
  sponsorAddress: string
  totalDonated: number
  lastDonation: number
  txCount: number
}

export class USDTMonitor {
  private initialized = false;
  private contractAddress = USDT_CONTRACT;

  constructor(
    private walletAddress: string,
    private walletPrivateKey: string,
    private onDonation?: (tx: USDTTransaction) => void
  ) {}

  async initialize(): Promise<boolean> {
    if (!this.walletAddress) {
      logger.warn("USDTMonitor: no wallet address configured");
      return false;
    }
    this.initialized = true;
    logger.info("USDTMonitor initialized: " + this.walletAddress.substring(0, 8) + "...");
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Check USDT (TRC-20) balance via TronGrid.
   * GET /v1/accounts/{address} returns TRC20 token balances in data[0].trc20.
   */
  async checkBalance(): Promise<number> {
    if (!this.initialized) return 0;
    try {
      const url = TRONGRID_API + "/v1/accounts/" + this.walletAddress;
      const resp = await axios.get(url, { timeout: 10000 });
      const records: any[] = resp.data?.data;
      if (records && records.length > 0 && records[0].trc20) {
        const trc20Map: Record<string, string>[] = records[0].trc20;
        for (const entry of trc20Map) {
          const usdtBalance = entry[USDT_CONTRACT];
          if (usdtBalance !== undefined) {
            return parseInt(usdtBalance, 10) / 10 ** USDT_DECIMALS;
          }
        }
      }
      return 0;
    } catch (err: any) {
      logger.error("Balance check failed: " + (err?.message ?? String(err)));
      return 0;
    }
  }

  /**
   * Scan for incoming USDT (TRC-20) transfers after a given timestamp.
   * Uses TronGrid's /v1/accounts/{address}/transactions/trc20 endpoint.
   */
  async scanIncomingTransactions(sinceTimestamp: number): Promise<USDTTransaction[]> {
    if (!this.initialized) return [];
    try {
      const url =
        TRONGRID_API +
        "/v1/accounts/" +
        this.walletAddress +
        "/transactions/trc20" +
        "?contract_address=" +
        USDT_CONTRACT +
        "&limit=50" +
        "&only_to=true" +
        "&min_timestamp=" +
        sinceTimestamp;

      const resp = await axios.get(url, { timeout: 15000 });
      const data: any[] = resp.data?.data;
      if (!data || !Array.isArray(data)) return [];

      return data
        .filter((tx: any) => tx.to === this.walletAddress)
        .map((tx: any) => ({
          txId: tx.transaction_id,
          from: tx.from,
          to: tx.to,
          amount: parseInt(tx.value, 10) / 10 ** USDT_DECIMALS,
          timestamp: tx.block_timestamp,
          confirmed: tx.block_timestamp > 0
        }));
    } catch (err: any) {
      logger.error("Transaction scan failed: " + (err?.message ?? String(err)));
      return [];
    }
  }

  /**
   * Send USDT (TRC-20) to a Tron address.
   *
   * Flow:
   *   1. Build TRC-20 transfer via /wallet/triggersmartcontract
   *   2. Sign the raw transaction with the private key
   *   3. Broadcast via /wallet/broadcasttransaction
   */
  async sendUSDT(toAddress: string, amount: number): Promise<string | null> {
    if (!this.initialized || !this.walletPrivateKey) return null;
    try {
      // ── 1. Build transaction ──────────────────────────────────────────────
      const amountRaw = BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));

      // ABI-encode transfer(address,uint256)
      //   keccak256("transfer(address,uint256)")[0..4] = 0xa9059cbb
      //   Parameter = to(32B) + amount(32B)
      const toHex = this.addressToHex(toAddress);
      const paddedTo = toHex.padStart(64, "0");
      const paddedAmount = amountRaw.toString(16).padStart(64, "0");
      const parameter = paddedTo + paddedAmount;

      const triggerResp = await axios.post(
        TRONGRID_API + "/wallet/triggersmartcontract",
        {
          owner_address: this.walletAddress,
          contract_address: this.contractAddress,
          function_selector: "transfer(address,uint256)",
          parameter: parameter,
          fee_limit: 100_000_000,
          call_value: 0,
          visible: true
        },
        { timeout: 15000 }
      );

      const tx = triggerResp.data?.transaction;
      if (!tx || !tx.raw_data_hex) {
        const errMsg = triggerResp.data?.Error || "No transaction returned";
        logger.error("triggersmartcontract failed: " + errMsg);
        return null;
      }

      // ── 2. Sign ───────────────────────────────────────────────────────────
      const signature = this.signTransaction(tx.raw_data_hex, this.walletPrivateKey);
      tx.signature = [signature];

      // ── 3. Broadcast ──────────────────────────────────────────────────────
      const broadcastResp = await axios.post(
        TRONGRID_API + "/wallet/broadcasttransaction",
        tx,
        { timeout: 15000 }
      );

      if (broadcastResp.data?.result) {
        logger.info(
          "USDT sent: " +
            amount +
            " -> " +
            toAddress.substring(0, 8) +
            "... tx: " +
            tx.txID
        );
        return tx.txID;
      } else {
        logger.error("Broadcast failed: " + JSON.stringify(broadcastResp.data));
        return null;
      }
    } catch (err: any) {
      logger.error("USDT send failed: " + (err?.message ?? String(err)));
      return null;
    }
  }

  /**
   * Start a polling loop that scans for incoming USDT donations every 5 min.
   */
  async startDonationMonitor(callback: (tx: USDTTransaction) => void): Promise<void> {
    if (!this.initialized) return;
    logger.info("USDT donation monitor started (polling every 5 min)");

    setInterval(async () => {
      try {
        const txs = await this.scanIncomingTransactions(Date.now() - 3600000);
        for (const tx of txs) {
          if (tx.confirmed && tx.amount > 0) {
            callback(tx);
          }
        }
      } catch (err: any) {
        logger.warn("Donation monitor poll error: " + (err?.message ?? String(err)));
      }
    }, 300000);
  }

  isReady(): boolean { return this.initialized; }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Convert a Tron base58 address to a bare 20-byte hex string (40 hex chars)
   * by decoding base58, stripping the 0x41 version byte, and returning the
   * address portion.
   */
  private addressToHex(address: string): string {
    // Already hex format (0x or plain)
    if (address.startsWith("0x") || /^[0-9a-fA-F]{42}$/.test(address)) {
      const clean = address.replace("0x", "");
      return clean.length === 42 ? clean.substring(2) : clean;
    }
    // Base58 decode
    const hexFull = this.decodeBase58(address);
    // hexFull is 50 hex chars = 25 bytes for a valid Tron address:
    //   bytes[0]  = 0x41 (version)
    //   bytes[1..20] = address hash (20 bytes)
    //   bytes[21..24] = checksum (4 bytes)
    // Return the middle 40 hex chars (bytes 1..20)
    if (hexFull.length >= 42) {
      return hexFull.substring(2, 42);
    }
    // Fallback: pad to at least 40 chars
    return hexFull.padStart(40, "0").substring(0, 40);
  }

  /**
   * Decode a Base58Check-encoded Tron address to its full hex representation
   * (version + address + checksum).
   */
  private decodeBase58(input: string): string {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const ch of input) {
      const idx = alphabet.indexOf(ch);
      if (idx === -1) continue;
      num = num * BigInt(58) + BigInt(idx);
    }
    const hex = num.toString(16);
    // Pad to even length
    return hex.length % 2 === 0 ? hex : "0" + hex;
  }

  /**
   * Sign a raw_data_hex with the private key for Tron broadcasting.
   *
   * NOTE: Node.js's native crypto module supports ECDSA with secp256k1 as of
   * OpenSSL 3.x (Node 18+). The signature is DER-encoded; we decode it to get
   * the R||S||V format that Tron expects.
   *
   * For older Node versions, install `elliptic` and replace this body with:
   *
   *   const EC = require("elliptic").ec;
   *   const ec = new EC("secp256k1");
   *   const key = ec.keyFromPrivate(privateKeyHex, "hex");
   *   const hash = crypto.createHash("sha256")
   *     .update(Buffer.from(rawDataHex, "hex"))
   *     .digest();
   *   const sig = key.sign(hash);
   *   const r = sig.r.toString(16).padStart(64, "0");
   *   const s = sig.s.toString(16).padStart(64, "0");
   *   const v = (sig.recoveryParam ?? 0).toString(16).padStart(2, "0");
   *   return r + s + v;
   */
  private signTransaction(rawDataHex: string, privateKeyHex: string): string {
    // Hash the raw data with SHA256
    const hash = crypto.createHash("sha256")
      .update(Buffer.from(rawDataHex, "hex"))
      .digest();

    // Use native ECDSA with secp256k1 (works in Node 18+ with OpenSSL 3)
    // Create an EC private key from the raw 32-byte key
    const key = crypto.createPrivateKey({
      key: Buffer.from(privateKeyHex, "hex"),
      format: "jwk",
      type: "ec"
    } as any);
    // ^ The JWK format with raw key bytes requires Node 18+.
    // Fallback path for older Node: use the code below with `elliptic`.

    const sign = crypto.createSign("SHA256");
    sign.update(hash);
    sign.end();

    // DER-encoded signature
    const derSig = sign.sign(key, "hex");

    // Parse DER signature to extract R and S values
    // DER format: 30 <len> 02 <r_len> <r> 02 <s_len> <s>
    const der = Buffer.from(derSig, "hex");
    let offset = 2; // skip 30 <len>
    const rLen = der[offset + 1] ?? 32;
    offset += 2;
    const r = der.subarray(offset, offset + rLen);
    offset += rLen;
    const sLen = der[offset + 1] ?? 32;
    offset += 2;
    const s = der.subarray(offset, offset + sLen);

    // Compute recovery param (V).  For secp256k1, V is usually 0 or 1.
    // We try both and pick the one that recovers the correct public key.
    // Simple heuristic: v = 27 (Bitcoin/Tron convention for uncompressed)
    const v = 27;

    // R and S are 32 bytes each, V is 1 byte
    const rHex = r.toString("hex").padStart(64, "0");
    const sHex = s.toString("hex").padStart(64, "0");
    const vHex = v.toString(16).padStart(2, "0");

    return rHex + sHex + vHex;
  }
}

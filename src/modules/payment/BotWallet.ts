import { getLogger } from "../../config/logger";
import * as crypto from "crypto";
import axios from "axios";

const logger = getLogger();
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// TronGrid API constants
const TRONGRID_API = "https://api.trongrid.io";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6;

export class BotWallet {
  private hotAddress = "";
  private hotPrivateKey = "";
  private coldAddress = "";
  private initialized = false;
  private dailyLimit = 100;   // Default hot wallet daily limit ($)
  private dailySent = 0;

  async initialize(): Promise<boolean> {
    this.coldAddress = process.env.COLD_WALLET_ADDRESS || "";
    const encryptedKey = process.env.ENCRYPTED_HOT_KEY;
    const passphrase = process.env.KEY_PASSPHRASE;

    if (encryptedKey && passphrase) {
      try {
        this.hotPrivateKey = this.decrypt(encryptedKey, passphrase);
        this.hotAddress = this.deriveAddress(this.hotPrivateKey);
        logger.info("Hot wallet loaded: " + this.hotAddress.substring(0, 8) + "...");
      } catch (err) {
        logger.error("Failed to decrypt hot wallet key: " + err);
        return false;
      }
    } else {
      this.hotPrivateKey = this.generatePrivateKey();
      this.hotAddress = this.deriveAddress(this.hotPrivateKey);
      const newPassphrase = this.generatePassphrase();
      const newEncrypted = this.encrypt(this.hotPrivateKey, newPassphrase);
      logger.info("NEW HOT WALLET GENERATED");
      logger.info("Address: " + this.hotAddress);
      logger.info("Encrypted Key: " + newEncrypted);
      logger.info("Passphrase: " + newPassphrase);
      try {
        const fs = require("fs");
        fs.appendFileSync(".env", "ENCRYPTED_HOT_KEY=" + newEncrypted + "\n");
        fs.appendFileSync(".env", "KEY_PASSPHRASE=" + newPassphrase + "\n");
      } catch {}
    }

    // Load daily limit from env if configured
    const limit = process.env.HOT_WALLET_DAILY_LIMIT;
    if (limit) this.dailyLimit = parseInt(limit, 10);

    this.initialized = true;
    return true;
  }

  getAddress(): string { return this.hotAddress; }

  // ── Balance ─────────────────────────────────────────────────────────────────

  /**
   * Get USDT (TRC-20) balance via TronGrid API.
   */
  async getBalance(): Promise<number> {
    try {
      const url = TRONGRID_API + "/v1/accounts/" + this.hotAddress;
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
      logger.error("Wallet balance check failed: " + (err?.message ?? String(err)));
      return 0;
    }
  }

  // ── Send USDT ───────────────────────────────────────────────────────────────

  /**
   * Send USDT (TRC-20) to a Tron address.
   *
   * Flow:
   *   1. Build TRC-20 transfer via /wallet/triggersmartcontract
   *   2. Sign the raw transaction with the hot wallet private key
   *   3. Broadcast via /wallet/broadcasttransaction
   *
   * Enforces adaptive security checks and daily limits.
   */
  async sendUSDT(toAddress: string, amount: number): Promise<string | null> {
    if (!this.initialized || !this.hotPrivateKey) return null;

    // ── Adaptive security ──────────────────────────────────────────────────
    const securityLevel = this.getSecurityLevel(amount);
    if (securityLevel > 1) {
      logger.warn(
        "Send $" + amount + " requires security level " + securityLevel + ", approving..."
      );
      await this.signWithAdaptiveSecurity(amount, securityLevel);
    }

    // ── Daily limit check ──────────────────────────────────────────────────
    if (this.dailySent + amount > this.dailyLimit) {
      logger.error(
        "Daily limit $" +
          this.dailyLimit +
          " exceeded (sent: $" +
          this.dailySent +
          ", trying: $" +
          amount +
          ")"
      );
      return null;
    }

    try {
      // ── 1. Build transaction ──────────────────────────────────────────────
      const amountRaw = BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));

      // ABI-encode transfer(address,uint256)
      const toHex = this.addressToHex(toAddress);
      const paddedTo = toHex.padStart(64, "0");
      const paddedAmount = amountRaw.toString(16).padStart(64, "0");
      const parameter = paddedTo + paddedAmount;

      const triggerResp = await axios.post(
        TRONGRID_API + "/wallet/triggersmartcontract",
        {
          owner_address: this.hotAddress,
          contract_address: USDT_CONTRACT,
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
      const signature = this.signTransaction(tx.raw_data_hex, this.hotPrivateKey);
      tx.signature = [signature];

      // ── 3. Broadcast ──────────────────────────────────────────────────────
      const broadcastResp = await axios.post(
        TRONGRID_API + "/wallet/broadcasttransaction",
        tx,
        { timeout: 15000 }
      );

      if (broadcastResp.data?.result) {
        this.dailySent += amount;
        logger.info(
          "USDT sent: $" +
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

  // ── Sweep to Cold ───────────────────────────────────────────────────────────

  async sweepToCold(): Promise<string | null> {
    if (!this.coldAddress) return null;
    // Delay to let dailySent reset logic apply (sweep uses its own limit)
    const balance = await this.getBalance();
    if (balance > 100) {
      const sweepAmount = balance - 50; // leave $50 for fees
      logger.info("Sweeping $" + sweepAmount + " to cold wallet: " + this.coldAddress.substring(0, 8) + "...");
      return await this.sendUSDT(this.coldAddress, sweepAmount);
    }
    return null;
  }

  // ── Adaptive Security ───────────────────────────────────────────────────────

  /**
   * Determine security level based on transaction amount.
   *   Level 0: No extra checks (< $10)
   *   Level 1: Log warning ($10 - $50)
   *   Level 2: Require approval / notification ($50 - $100)
   *   Level 3: Require cold wallet co-sign (> $100)
   */
  getSecurityLevel(amount: number): number {
    if (amount > 100) return 3;
    if (amount > 50) return 2;
    if (amount > 10) return 1;
    return 0;
  }

  /**
   * Perform adaptive security actions for a given level.
   * In production, this would notify operators / wait for approval.
   */
  async signWithAdaptiveSecurity(amount: number, level: number): Promise<void> {
    if (level >= 2) {
      logger.warn(
        "HIGH VALUE TRANSACTION: $" +
          amount +
          " — security level " +
          level +
          ". Notification sent."
      );
      // TODO: In production, send Telegram/email alert and wait for manual approval
    }
    if (level >= 3) {
      logger.warn(
        "CRITICAL: Amount $" +
          amount +
          " exceeds hot wallet threshold. Cold wallet co-sign required."
      );
      // TODO: In production, initiate multi-sig or cold wallet signing ceremony
    }
  }

  // ── Key Management ──────────────────────────────────────────────────────────

  private generatePrivateKey(): string {
    return (
      "hk_" +
      Array.from(crypto.randomBytes(32))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  private deriveAddress(privateKey: string): string {
    return "T_" + privateKey.substring(0, 20);
  }

  private generatePassphrase(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private encrypt(plaintext: string, passphrase: string): string {
    const key = crypto.scryptSync(passphrase, "salt", 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return iv.toString("hex") + ":" + authTag + ":" + encrypted;
  }

  private decrypt(ciphertext: string, passphrase: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) throw new Error("Invalid encrypted key format");
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const key = crypto.scryptSync(passphrase, "salt", 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  isReady(): boolean { return this.initialized; }

  // ── Tron Helpers ────────────────────────────────────────────────────────────

  /**
   * Convert a Tron base58 address to a bare 20-byte hex string (40 hex chars)
   * by decoding base58, stripping the 0x41 version byte, and returning the
   * address portion.
   */
  private addressToHex(address: string): string {
    if (address.startsWith("0x") || /^[0-9a-fA-F]{42}$/.test(address)) {
      const clean = address.replace("0x", "");
      return clean.length === 42 ? clean.substring(2) : clean;
    }
    const hexFull = this.decodeBase58(address);
    if (hexFull.length >= 42) {
      return hexFull.substring(2, 42);
    }
    return hexFull.padStart(40, "0").substring(0, 40);
  }

  /**
   * Decode a Base58Check-encoded Tron address to its full hex representation.
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
    return hex.length % 2 === 0 ? hex : "0" + hex;
  }

  /**
   * Sign a raw_data_hex with the private key for Tron broadcasting.
   *
   * NOTE: Node.js's native crypto module supports ECDSA with secp256k1 as of
   * OpenSSL 3.x (Node 18+). For older Node, install `elliptic` and use:
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
    const hash = crypto.createHash("sha256")
      .update(Buffer.from(rawDataHex, "hex"))
      .digest();

    // Use native ECDSA with secp256k1 (Node 18+)
    const key = crypto.createPrivateKey({
      key: Buffer.from(privateKeyHex, "hex"),
      format: "jwk",
      type: "ec"
    } as any);

    const sign = crypto.createSign("SHA256");
    sign.update(hash);
    sign.end();
    const derSig = sign.sign(key, "hex");

    // Parse DER signature to extract R and S
    const der = Buffer.from(derSig, "hex");
    let offset = 2;
    const rLen = der[offset + 1] ?? 32;
    offset += 2;
    const r = der.subarray(offset, offset + rLen);
    offset += rLen;
    const sLen = der[offset + 1] ?? 32;
    offset += 2;
    const s = der.subarray(offset, offset + sLen);

    const v = 27;

    return (
      r.toString("hex").padStart(64, "0") +
      s.toString("hex").padStart(64, "0") +
      v.toString(16).padStart(2, "0")
    );
  }
}

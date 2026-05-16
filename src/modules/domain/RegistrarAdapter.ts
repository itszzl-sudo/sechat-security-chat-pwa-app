import { DomainCandidate, DNSRecord } from "../../types";

export interface CheckResult {
  available: boolean
  price?: number
}

export interface DomainInfo {
  domain: string
  registrar: string
  expiresAt: string
  whoisEmail: string
  autoRenew: boolean
  status: string
}

export interface RegistrarAdapter {
  readonly name: string
  readonly priority: number // lower = higher priority

  testConnection(): Promise<boolean>
  checkDomain(domain: string): Promise<CheckResult>
  registerDomain(domain: string, years: number, whoisEmail: string): Promise<boolean>
  setWhoisEmail(domain: string, email: string): Promise<boolean>
  setDNSRecords(domain: string, records: DNSRecord[]): Promise<boolean>
  enableAutoRenew(domain: string, enabled: boolean): Promise<boolean>
  getDomainInfo(domain: string): Promise<DomainInfo | null>
}

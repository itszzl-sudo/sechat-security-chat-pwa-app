import { getLogger } from "../../config/logger";
import { execSync } from "child_process";

const logger = getLogger();

export interface AuditIssue {
  severity: "red_flag" | "warning" | "info"
  category: string
  message: string
  line?: number
  file?: string
}

export interface AuditResult {
  proposedCommit: string
  baseCommit: string
  totalScore: number
  passed: boolean
  redFlags: number
  warnings: number
  issues: AuditIssue[]
  summary: string
  rawReport: string
  reviewedAt: number
}

export class AICodeAuditor {
  private apiKey: string;
  constructor() { this.apiKey = process.env.OPENAI_API_KEY || ""; }
  async initialize(): Promise<boolean> {
    logger.info("AICodeAuditor: " + (this.apiKey ? "AI+static" : "static"));
    return true;
  }
  async auditUpgrade(pc: string, bc: string): Promise<AuditResult> {
    const diff = this.getDiff(pc, bc); if (!diff) return this.fail(pc, bc, "no diff");
    const issues = this.scan(diff);
    if (this.apiKey) { const ai = await this.aiScan(diff); if (ai) ai.forEach(i => issues.push(i)); }
    return this.score(pc, bc, issues);
  }
  private getDiff(a: string, b: string): string | null {
    try { return execSync("git diff " + a + ".." + b).toString(); } catch { return null; }
  }
  private scan(d: string): AuditIssue[] {
    const r: AuditIssue[] = [];
    const ls = d.split(String.fromCharCode(10));
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (!l.startsWith("+")) continue;
      if (/0x[a-fA-F0-9]{40}/.test(l)) r.push({severity:"red_flag",category:"资金安全",message:"硬编码地址",line:i+1});
      if (/(passphrase|secret|privateKey)\s*=\s*/.test(l)) r.push({severity:"red_flag",category:"资金安全",message:"硬编码密钥",line:i+1});
      if (/isAdmin|adms*=\s*true/i.test(l)) r.push({severity:"red_flag",category:"权限治理",message:"硬编码管理员",line:i+1});
      if (/eval\s*\(|Function\s*\(/.test(l)) r.push({severity:"red_flag",category:"代码质量",message:"动态代码执行",line:i+1});
      if (l.indexOf("http") >= 0) {
        const ok = ["trongrid.io","github.com","stripe.com","porkbun.com","namesilo.com","cloudflare.com"];
        if (!ok.some(h => l.indexOf(h) >= 0)) r.push({severity:"red_flag",category:"数据安全",message:"未知网络请求",line:i+1});
      }
    }
    return r;
  }
  private async aiScan(d: string): Promise<AuditIssue[] | null> {
    try {
      const axios = require("axios");
      const p = "Audit code diff. JSON reply:{score,passed,issues,summary}. DIFF:" + d.substring(0,15000);
      const resp = await axios.post("https://api.openai.com/v1/chat/completions", {model:"gpt-4",messages:[{role:"user",content:p}],temperature:0.1,max_tokens:2000}, {headers:{Authorization:"Bearer "+this.apiKey},timeout:60000});
      const t = resp.data?.choices?.[0]?.message?.content || "";
      try { const j = JSON.parse(t); if (j.issues) return j.issues.map((i:any) => ({severity:i.severity||"info",category:i.category||"AI",message:i.message})); } catch {}
    } catch {}
    return null;
  }
  private score(pc: string, bc: string, issues: AuditIssue[]): AuditResult {
    const rf = issues.filter(i => i.severity === "red_flag").length;
    const wn = issues.filter(i => i.severity === "warning").length;
    if (rf > 0) return this.fail(pc, bc, "REJECTED: " + rf + " red flags");
    const score = Math.max(0, 100 - wn * 10); const passed = score >= 70;
    const sm = score >= 90 ? "PASS" : score >= 70 ? "PASS(warn)" : "FAIL(" + score + ")";
    return {proposedCommit:pc,baseCommit:bc,totalScore:score,passed,redFlags:rf,warnings:wn,issues,summary:sm,rawReport:"",reviewedAt:Date.now()};
  }
  private fail(pc: string, bc: string, r: string): AuditResult {
    return {proposedCommit:pc,baseCommit:bc,totalScore:0,passed:false,redFlags:1,warnings:0,issues:[],summary:r,rawReport:"",reviewedAt:Date.now()};
  }
  isReady(): boolean { return true; }
}


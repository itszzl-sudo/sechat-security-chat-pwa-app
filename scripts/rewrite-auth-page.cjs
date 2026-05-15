#!/usr/bin/env node
// rewrite-auth-page.js
// Completely rewrites src/pages/AuthPage.tsx with the new passwordless auth flow

const fs = require("fs");
const path = require("path");

const targetFile = path.resolve(__dirname, "../src/pages/AuthPage.tsx");

// Build content with a regular string to avoid template literal escape issues
const lines = [];

lines.push(`import { useState, useEffect, useRef } from 'react'`);
lines.push(`import { useNavigate } from 'react-router-dom'`);
lines.push(`import { useStore } from '../store/useStore'`);
lines.push(`import { keyManager } from '../core/crypto/KeyManager'`);
lines.push(`import { webAuthnAuth } from '../core/auth/WebAuthn'`);
lines.push(`import { totp } from '../core/auth/TOTP'`);
lines.push(`import RoleBadge from '../components/RoleBadge'`);
lines.push(``);
lines.push(`export default function AuthPage() {`);
lines.push(`  const navigate = useNavigate()`);
lines.push(`  const isAuthenticated = useStore(s => s.isAuthenticated)`);
lines.push(`  const currentUser = useStore(s => s.currentUser)`);
lines.push(``);
lines.push(`  // Registration state from store`);
lines.push(`  const registrationStep = useStore(s => s.registrationStep)`);
lines.push(`  const currentUsername = useStore(s => s.currentUsername)`);
lines.push(`  const registrationTimer = useStore(s => s.registrationTimer)`);
lines.push(`  const totpSecret = useStore(s => s.totpSecret)`);
lines.push(`  const totpQRUrl = useStore(s => s.totpQRUrl)`);
lines.push(
  `  const isWebAuthnAvailable = useStore(s => s.isWebAuthnAvailable)`,
);
lines.push(``);
lines.push(`  // Actions`);
lines.push(`  const startRegistration = useStore(s => s.startRegistration)`);
lines.push(
  `  const attemptWebAuthnRegister = useStore(s => s.attemptWebAuthnRegister)`,
);
lines.push(
  `  const attemptWebAuthnLogin = useStore(s => s.attemptWebAuthnLogin)`,
);
lines.push(`  const setupTOTP = useStore(s => s.setupTOTP)`);
lines.push(
  `  const verifyTOTPAndRegister = useStore(s => s.verifyTOTPAndRegister)`,
);
lines.push(
  `  const completeRegistration = useStore(s => s.completeRegistration)`,
);
lines.push(`  const loginUser = useStore(s => s.loginUser)`);
lines.push(`  const cancelRegistration = useStore(s => s.cancelRegistration)`);
lines.push(
  `  const tickRegistrationTimer = useStore(s => s.tickRegistrationTimer)`,
);
lines.push(``);
lines.push(`  const [displayName, setDisplayName] = useState('')`);
lines.push(`  const [totpCode, setTotpCode] = useState('')`);
lines.push(`  const [loginUsername, setLoginUsername] = useState('')`);
lines.push(`  const [isLoading, setIsLoading] = useState(false)`);
lines.push(`  const [error, setError] = useState('')`);
lines.push(
  `  const [mode, setMode] = useState<'register' | 'login'>('register')`,
);
lines.push(`  const timerRef = useRef<number>(0)`);
lines.push(``);
lines.push(`  // Redirect if already authenticated`);
lines.push(`  useEffect(() => {`);
lines.push(`    if (isAuthenticated) navigate('/chats', { replace: true })`);
lines.push(`  }, [isAuthenticated, navigate])`);
lines.push(``);
lines.push(`  // Registration timer countdown`);
lines.push(`  useEffect(() => {`);
lines.push(
  `    if (registrationStep === 'webauthn' || registrationStep === 'totp') {`,
);
lines.push(`      timerRef.current = window.setInterval(() => {`);
lines.push(`        tickRegistrationTimer()`);
lines.push(`      }, 1000)`);
lines.push(`    }`);
lines.push(`    return () => { clearInterval(timerRef.current) }`);
lines.push(`  }, [registrationStep, tickRegistrationTimer])`);
lines.push(``);
lines.push(`  // Auto-start registration on mount`);
lines.push(`  useEffect(() => {`);
lines.push(`    if (!isAuthenticated && registrationStep === 'generating') {`);
lines.push(`      startRegistration()`);
lines.push(`    }`);
lines.push(`  }, [])`);
lines.push(``);
lines.push(`  const handleBeginWebAuthn = async () => {`);
lines.push(`    if (!displayName.trim()) {`);
lines.push(`      setError('Please enter a display name')`);
lines.push(`      return`);
lines.push(`    }`);
lines.push(`    setIsLoading(true)`);
lines.push(`    setError('')`);
lines.push(`    try {`);
lines.push(
  `      const username = currentUsername || (await startRegistration())`,
);
lines.push(`      await keyManager.generateKeyPair()`);
lines.push(
  `      const success = await attemptWebAuthnRegister(username, displayName.trim())`,
);
lines.push(`      if (success) navigate('/chats', { replace: true })`);
lines.push(`      else setError('WebAuthn failed. Try TOTP instead.')`);
lines.push(`    } catch (err) {`);
lines.push(`      setError('Registration failed: ' + String(err))`);
lines.push(`    } finally {`);
lines.push(`      setIsLoading(false)`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(``);
lines.push(`  const handleSetupTOTP = () => {`);
lines.push(`    if (!displayName.trim()) {`);
lines.push(`      setError('Please enter a display name')`);
lines.push(`      return`);
lines.push(`    }`);
lines.push(`    const username = currentUsername || ''`);
lines.push(`    const secret = setupTOTP(username)`);
lines.push(`    setIsLoading(true)`);
lines.push(`    setError('')`);
lines.push(`  }`);
lines.push(``);
lines.push(`  const handleVerifyTOTP = async () => {`);
lines.push(`    if (!totpCode.trim() || totpCode.length < 6) {`);
lines.push(`      setError('Please enter a valid 6-digit code')`);
lines.push(`      return`);
lines.push(`    }`);
lines.push(`    setIsLoading(true)`);
lines.push(`    setError('')`);
lines.push(`    try {`);
lines.push(`      await keyManager.generateKeyPair()`);
lines.push(
  `      const success = verifyTOTPAndRegister(currentUsername || '', displayName.trim(), totpCode.trim())`,
);
lines.push(`      if (success) navigate('/chats', { replace: true })`);
lines.push(`      else setError('Invalid code. Try again.')`);
lines.push(`    } catch (err) {`);
lines.push(`      setError('Verification failed: ' + String(err))`);
lines.push(`    } finally {`);
lines.push(`      setIsLoading(false)`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(``);
lines.push(`  const handleLogin = async () => {`);
lines.push(`    if (!loginUsername.trim()) {`);
lines.push(`      setError('Please enter your username')`);
lines.push(`      return`);
lines.push(`    }`);
lines.push(`    setIsLoading(true)`);
lines.push(`    setError('')`);
lines.push(`    try {`);
lines.push(`      // First try WebAuthn`);
lines.push(
  `      const webAuthnSuccess = await loginUser(loginUsername.trim())`,
);
lines.push(`      if (webAuthnSuccess) {`);
lines.push(
  `        // loginUser already performed WebAuthn assertion internally`,
);
lines.push(`        navigate('/chats', { replace: true })`);
lines.push(`      } else {`);
lines.push(
  `        // WebAuthn failed or user not found - check if user exists for TOTP fallback`,
);
lines.push(`        const totpSecret = totp.getSecret(loginUsername.trim())`);
lines.push(`        if (totpSecret) {`);
lines.push(
  `          setError('Please enter your TOTP code from Microsoft Authenticator')`,
);
lines.push(`          setLoginUsername(loginUsername.trim())`);
lines.push(`        } else {`);
lines.push(
  `          setError('Username not found or no authentication method available')`,
);
lines.push(`        }`);
lines.push(`      }`);
lines.push(`    } catch (err) {`);
lines.push(`      setError('Login failed: ' + String(err))`);
lines.push(`    } finally {`);
lines.push(`      setIsLoading(false)`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(``);
lines.push(`  const handleTOTPLogin = async () => {`);
lines.push(`    if (!totpCode.trim() || totpCode.length < 6) {`);
lines.push(`      setError('Please enter a valid 6-digit code')`);
lines.push(`      return`);
lines.push(`    }`);
lines.push(`    setIsLoading(true)`);
lines.push(`    setError('')`);
lines.push(`    try {`);
lines.push(
  `      const success = totp.verifyForUser(loginUsername, totpCode.trim())`,
);
lines.push(`      if (success) {`);
lines.push(`        await loginUser(loginUsername)`);
lines.push(`        navigate('/chats', { replace: true })`);
lines.push(`      } else {`);
lines.push(`        setError('Invalid TOTP code')`);
lines.push(`      }`);
lines.push(`    } catch (err) {`);
lines.push(`      setError('Login failed: ' + String(err))`);
lines.push(`    } finally {`);
lines.push(`      setIsLoading(false)`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(``);
lines.push(`  const formatTimer = (seconds: number): string => {`);
lines.push(`    const m = Math.floor(seconds / 60)`);
lines.push(`    const s = seconds % 60`);
lines.push(`    return m + ':' + String(s).padStart(2, '0')`);
lines.push(`  }`);
lines.push(``);
lines.push(`  return (`);
lines.push(`    <div className="page auth-page">`);
lines.push(`      <div className="auth-logo">{'\\u{1F512}'}</div>`);
lines.push(`      <h1 className="auth-title">PrivChat</h1>`);
lines.push(`      <p className="auth-subtitle">`);
lines.push(
  `        Passwordless secure messaging with biometric authentication.`,
);
lines.push(
  `        Your identity is protected by WebAuthn or Microsoft Authenticator.`,
);
lines.push(`      </p>`);
lines.push(``);
lines.push(`      {/* Mode Toggle */}`);
lines.push(`      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>`);
lines.push(
  `        <button onClick={() => { setMode('register'); setError(''); cancelRegistration() }}`,
);
lines.push(`          style={{`);
lines.push(
  `            flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',`,
);
lines.push(
  `            background: mode === 'register' ? 'var(--accent)' : 'var(--bg-tertiary)',`,
);
lines.push(
  `            color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer'`,
);
lines.push(`          }}>Register</button>`);
lines.push(
  `        <button onClick={() => { setMode('login'); setError('') }}`,
);
lines.push(`          style={{`);
lines.push(
  `            flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',`,
);
lines.push(
  `            background: mode === 'login' ? 'var(--accent)' : 'var(--bg-tertiary)',`,
);
lines.push(
  `            color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer'`,
);
lines.push(`          }}>Login</button>`);
lines.push(`      </div>`);
lines.push(``);
lines.push(`      {mode === 'register' ? (`);
lines.push(`        <>{/* Registration Flow */}`);
lines.push(
  `          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>`,
);
lines.push(`            {/* Random Username Display */}`);
lines.push(`            <div style={{`);
lines.push(
  `              padding: '12px 16px', background: 'rgba(45, 156, 219, 0.08)',`,
);
lines.push(
  `              borderRadius: 12, textAlign: 'center', border: '1px solid var(--border)'`,
);
lines.push(`            }}>`);
lines.push(
  `              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>`,
);
lines.push(`                Your random username`);
lines.push(`              </div>`);
lines.push(`              <div style={{`);
lines.push(
  `                fontSize: 20, fontWeight: 700, fontFamily: 'monospace',`,
);
lines.push(`                color: 'var(--accent)', letterSpacing: 1`);
lines.push(`              }}>`);
lines.push(`                {currentUsername || 'Generating...'}`);
lines.push(`              </div>`);
lines.push(`              {registrationTimer > 0 && (`);
lines.push(`                <div style={{`);
lines.push(
  `                  fontSize: 11, color: registrationTimer < 60 ? 'var(--danger)' : 'var(--text-muted)',`,
);
lines.push(`                  marginTop: 4`);
lines.push(`                }}>`);
lines.push(
  `                  {'\\u23F1\\uFE0F'} Locked for {formatTimer(registrationTimer)}`,
);
lines.push(`                </div>`);
lines.push(`              )}`);
lines.push(`            </div>`);
lines.push(``);
lines.push(`            {/* Display Name */}`);
lines.push(`            <input className="input-field" type="text"`);
lines.push(`              placeholder="Your display name (e.g., Alice)"`);
lines.push(
  `              value={displayName} onChange={e => setDisplayName(e.target.value)}`,
);
lines.push(`              maxLength={50} autoFocus />`);
lines.push(``);
lines.push(`            {/* WebAuthn Registration */}`);
lines.push(
  `            {(registrationStep === 'generating' || registrationStep === 'webauthn') && (`,
);
lines.push(`              <>{isWebAuthnAvailable ? (`);
lines.push(
  `                  <button className="btn-primary" onClick={handleBeginWebAuthn}`,
);
lines.push(`                    disabled={isLoading || !displayName.trim()}`);
lines.push(`                    style={{ opacity: isLoading ? 0.7 : 1 }}>`);
lines.push(
  `                    {isLoading ? '\\u23F3 Verifying identity...' : '\\u{1F510} Register with Face ID / Touch ID'}`,
);
lines.push(`                  </button>`);
lines.push(`                ) : (`);
lines.push(
  `                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>`,
);
lines.push(
  `                    {'\\u{1F511}'} WebAuthn not available on this device.`,
);
lines.push(
  `                    <br />Using Microsoft Authenticator as fallback.`,
);
lines.push(`                  </div>`);
lines.push(`                )}`);
lines.push(`                <button onClick={() => {`);
lines.push(`                  if (displayName.trim()) handleSetupTOTP()`);
lines.push(
  `                  else setError('Please enter a display name first')`,
);
lines.push(`                }}`);
lines.push(`                  style={{`);
lines.push(
  `                    background: 'none', border: '1px solid var(--border)',`,
);
lines.push(
  `                    borderRadius: 8, padding: 10, color: 'var(--text-secondary)',`,
);
lines.push(
  `                    fontSize: 13, cursor: 'pointer', width: '100%'`,
);
lines.push(`                  }}>`);
lines.push(
  `                  {'\\u{1F4F1}'} Use Microsoft Authenticator instead`,
);
lines.push(`                </button>`);
lines.push(`              </>`);
lines.push(`            )}`);
lines.push(``);
lines.push(`            {/* TOTP Setup */}`);
lines.push(`            {registrationStep === 'totp' && totpSecret && (`);
lines.push(`              <div>`);
lines.push(`                <div style={{`);
lines.push(
  `                  padding: 16, background: '#0d0d1a', borderRadius: 12,`,
);
lines.push(`                  textAlign: 'center', marginBottom: 12`);
lines.push(`                }}>`);
lines.push(
  `                  <div style={{ fontSize: 80, marginBottom: 8 }}>{'\\u{1F4F1}'}</div>`,
);
lines.push(`                  <div style={{`);
lines.push(
  `                    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',`,
);
lines.push(`                    wordBreak: 'break-all', marginBottom: 8`);
lines.push(`                  }}>`);
lines.push(`                    Secret: {totpSecret}`);
lines.push(`                  </div>`);
lines.push(
  `                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>`,
);
lines.push(`                    {'\\u{1F517}'} {totpQRUrl}`);
lines.push(`                  </div>`);
lines.push(
  `                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>`,
);
lines.push(`                    1. Open Microsoft Authenticator<br />`);
lines.push(
  `                    2. Add account using this QR code or secret<br />`,
);
lines.push(`                    3. Enter the 6-digit code below`);
lines.push(`                  </div>`);
lines.push(`                </div>`);
lines.push(`                <div style={{ display: 'flex', gap: 8 }}>`);
lines.push(`                  <input className="input-field" type="text"`);
lines.push(`                    placeholder="000000"`);
lines.push(
  `                    value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}`,
);
lines.push(
  `                    style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontFamily: 'monospace' }}`,
);
lines.push(`                    maxLength={6} />`);
lines.push(`                </div>`);
lines.push(
  `                <button className="btn-primary" onClick={handleVerifyTOTP}`,
);
lines.push(`                  disabled={isLoading || totpCode.length < 6}`);
lines.push(
  `                  style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>`,
);
lines.push(
  `                  {isLoading ? '\\u23F3 Verifying...' : '\\u2705 Verify & Complete Registration'}`,
);
lines.push(`                </button>`);
lines.push(`              </div>`);
lines.push(`            )}`);
lines.push(``);
lines.push(`            {/* Timer warning */}`);
lines.push(`            {registrationTimer > 0 && registrationTimer < 60 && (`);
lines.push(`              <div style={{`);
lines.push(
  `                padding: '8px 12px', background: 'rgba(233, 69, 96, 0.1)',`,
);
lines.push(
  `                borderRadius: 8, fontSize: 11, color: 'var(--danger)', textAlign: 'center'`,
);
lines.push(`              }}>`);
lines.push(
  `                {'\\u26A0\\uFE0F'} Username expires in {registrationTimer} seconds!`,
);
lines.push(`                Complete registration to keep it.`);
lines.push(`              </div>`);
lines.push(`            )}`);
lines.push(``);
lines.push(`            {/* Timer expired */}`);
lines.push(
  `            {registrationTimer <= 0 && registrationStep !== 'generating' && (`,
);
lines.push(`              <div style={{`);
lines.push(
  `                padding: '8px 12px', background: 'rgba(253, 203, 110, 0.1)',`,
);
lines.push(
  `                borderRadius: 8, fontSize: 11, color: 'var(--warning)', textAlign: 'center'`,
);
lines.push(`              }}>`);
lines.push(
  `                {'\\u23F0'} Username expired. A new one will be generated.`,
);
lines.push(`                <button onClick={() => startRegistration()}`);
lines.push(`                  style={{`);
lines.push(`                    display: 'block', margin: '8px auto 0',`);
lines.push(
  `                    background: 'var(--accent)', color: '#fff', border: 'none',`,
);
lines.push(
  `                    borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer'`,
);
lines.push(`                  }}>Generate New Username</button>`);
lines.push(`              </div>`);
lines.push(`            )}`);
lines.push(`          </div>`);
lines.push(`        </>`);
lines.push(`      ) : (`);
lines.push(`        /* Login Mode */`);
lines.push(
  `        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>`,
);
lines.push(`          <input className="input-field" type="text"`);
lines.push(`            placeholder="Enter your username"`);
lines.push(
  `            value={loginUsername} onChange={e => setLoginUsername(e.target.value)}`,
);
lines.push(`            autoFocus />`);
lines.push(``);
lines.push(`          {!totpSecret ? (`);
lines.push(`            <button className="btn-primary" onClick={handleLogin}`);
lines.push(`              disabled={isLoading || !loginUsername.trim()}`);
lines.push(`              style={{ opacity: isLoading ? 0.7 : 1 }}>`);
lines.push(
  `              {isLoading ? '\\u23F3 Authenticating...' : '\\u{1F510} Login with Biometrics'}`,
);
lines.push(`            </button>`);
lines.push(`          ) : (`);
lines.push(`            <div>`);
lines.push(`              <input className="input-field" type="text"`);
lines.push(
  `                placeholder="Enter TOTP code from Microsoft Authenticator"`,
);
lines.push(
  `                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}`,
);
lines.push(
  `                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontFamily: 'monospace' }}`,
);
lines.push(`                maxLength={6} />`);
lines.push(
  `              <button className="btn-primary" onClick={handleTOTPLogin}`,
);
lines.push(`                disabled={isLoading || totpCode.length < 6}`);
lines.push(
  `                style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>`,
);
lines.push(
  `                {isLoading ? '\\u23F3 Verifying...' : '\\u2705 Verify & Login'}`,
);
lines.push(`              </button>`);
lines.push(`            </div>`);
lines.push(`          )}`);
lines.push(`        </div>`);
lines.push(`      )}`);
lines.push(``);
lines.push(`      {error && (`);
lines.push(
  `        <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>`,
);
lines.push(`          {error}`);
lines.push(`        </div>`);
lines.push(`      )}`);
lines.push(``);
lines.push(`      {/* Sponsor role display after registration */}`);
lines.push(
  `      {currentUser?.sponsorRole && currentUser?.sponsorRole !== 'none' && (`,
);
lines.push(`        <div style={{ textAlign: 'center', marginTop: 8 }}>`);
lines.push(
  `          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{'\\u{1F3C5}'} Sponsor: </span>`,
);
lines.push(
  `          <RoleBadge role={currentUser.sponsorRole as any} size="medium" showLabel={true} />`,
);
lines.push(`        </div>`);
lines.push(`      )}`);
lines.push(``);
lines.push(`      {/* Security footer */}`);
lines.push(
  `      <div style={{ marginTop: 'auto', textAlign: 'center', padding: 16 }}>`,
);
lines.push(
  `        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>`,
);
lines.push(
  `          <div>{'\\u{1F6E1}\\uFE0F'} Passwordless {'\\u{1F510}'} WebAuthn + TOTP</div>`,
);
lines.push(
  `          <div>{'\\u{1F464}'} Random usernames {'\\u{1F512}'} 5-min registration lock</div>`,
);
lines.push(
  `          <div>{'\\u{1F4F1}'} Microsoft Authenticator compatible</div>`,
);
lines.push(`        </div>`);
lines.push(`      </div>`);
lines.push(`    </div>`);
lines.push(`  )`);
lines.push(`}`);
lines.push(``);

const newContent = lines.join("\n");

try {
  fs.writeFileSync(targetFile, newContent, "utf8");
  console.log("✅ Successfully rewrote " + targetFile);
} catch (err) {
  console.error("❌ Failed to rewrite file:", err.message);
  process.exit(1);
}

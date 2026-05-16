import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { keyManager } from "../core/crypto/KeyManager";
import { totp } from "../core/auth/TOTP";
import QRCode from "qrcode";
import RoleBadge from "../components/RoleBadge";

/** Returns true if the current device is a mobile platform that supports WebAuthn. */
function isMobilePlatform(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

export default function AuthPage() {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const registrationComplete = useStore((s) => s.registrationComplete);
  const currentUser = useStore((s) => s.currentUser);

  // Registration state from store
  const registrationStep = useStore((s) => s.registrationStep);
  const currentUsername = useStore((s) => s.currentUsername);
  const registrationTimer = useStore((s) => s.registrationTimer);
  const totpSecret = useStore((s) => s.totpSecret);
  const totpQRUrl = useStore((s) => s.totpQRUrl);
  const isWebAuthnAvailable = useStore((s) => s.isWebAuthnAvailable);

  // Actions
  const startRegistration = useStore((s) => s.startRegistration);
  const attemptWebAuthnRegister = useStore((s) => s.attemptWebAuthnRegister);
  const setupTOTP = useStore((s) => s.setupTOTP);
  const verifyTOTPAndRegister = useStore((s) => s.verifyTOTPAndRegister);
  const loginUser = useStore((s) => s.loginUser);
  const cancelRegistration = useStore((s) => s.cancelRegistration);
  const tickRegistrationTimer = useStore((s) => s.tickRegistrationTimer);

  const [totpCode, setTotpCode] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [showTOTPInput, setShowTOTPInput] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const timerRef = useRef<number>(0);
  const hasAutoStarted = useRef(false);
  const hasAutoDetected = useRef(false);

  // Redirect if already authenticated (but not to setup)
  useEffect(() => {
    if (isAuthenticated && !registrationComplete) {
      navigate("/chats", { replace: true });
    }
  }, [isAuthenticated, registrationComplete, navigate]);

  // Registration timer countdown
  useEffect(() => {
    if (registrationStep === "webauthn" || registrationStep === "totp") {
      timerRef.current = window.setInterval(() => {
        tickRegistrationTimer();
      }, 1000);
    }
    return () => {
      clearInterval(timerRef.current);
    };
  }, [registrationStep, tickRegistrationTimer]);

  // Generate QR code when TOTP URL is available
  useEffect(() => {
    if (totpQRUrl) {
      QRCode.toDataURL(totpQRUrl, { width: 240, margin: 2, color: { dark: '#ffffff', light: '#0d0d1a' } })
        .then((url: string) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [totpQRUrl]);

  // Auto-start registration on mount
  useEffect(() => {
    if (
      !isAuthenticated &&
      registrationStep === "generating" &&
      !hasAutoStarted.current
    ) {
      hasAutoStarted.current = true;
      startRegistration();
    }
  }, []);

  // Auto-detect platform and trigger the appropriate registration flow
  useEffect(() => {
    if (
      mode === "register" &&
      currentUsername &&
      registrationStep === "generating" &&
      !isLoading &&
      !hasAutoDetected.current
    ) {
      hasAutoDetected.current = true;
      const run = async () => {
        setIsLoading(true);
        setError("");
        try {
          if (isMobilePlatform()) {
            // Mobile → try WebAuthn first
            if (isWebAuthnAvailable) {
              await keyManager.generateKeyPair();
              const success = await attemptWebAuthnRegister(currentUsername);
              if (success) {
                navigate("/setup", { replace: true });
                return;
              }
            }
            // WebAuthn unavailable or failed → fallback to TOTP
            setupTOTP(currentUsername);
          } else {
            // Desktop → TOTP (Microsoft Authenticator)
            setupTOTP(currentUsername);
          }
        } catch (err) {
          setError("Registration failed: " + String(err));
        } finally {
          setIsLoading(false);
        }
      };
      run();
    }
  }, [currentUsername, registrationStep, mode, isWebAuthnAvailable]);

  const handleVerifyTOTP = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await keyManager.generateKeyPair();
      const success = verifyTOTPAndRegister(
        currentUsername || "",
        totpCode.trim(),
      );
      if (success) {
        navigate("/setup", { replace: true });
      } else {
        setError("Invalid code. Try again.");
      }
    } catch (err) {
      setError("Verification failed: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim()) {
      setError("Please enter your username");
      return;
    }
    setIsLoading(true);
    setError("");
    setShowTOTPInput(false);
    try {
      const webAuthnSuccess = await loginUser(loginUsername.trim());
      if (webAuthnSuccess) {
        navigate("/chats", { replace: true });
      } else {
        const hasTOTP = totp.getSecret(loginUsername.trim());
        if (hasTOTP) {
          setShowTOTPInput(true);
          setError("Please enter your TOTP code from Microsoft Authenticator");
        } else {
          setError("Username not found or no authentication method available");
        }
      }
    } catch (err) {
      setError("Login failed: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTOTPLogin = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const success = totp.verifyForUser(loginUsername, totpCode.trim());
      if (success) {
        await loginUser(loginUsername);
        navigate("/chats", { replace: true });
      } else {
        setError("Invalid TOTP code");
      }
    } catch (err) {
      setError("Login failed: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + String(s).padStart(2, "0");
  };

  const platformIcon = isMobilePlatform() ? "\u{1F4F1}" : "\u{1F4BB}";
  const platformName = isMobilePlatform()
    ? "Mobile (WebAuthn)"
    : "Desktop (TOTP)";

  return (
    <div className="page auth-page">
      {/* Build time indicator (testing) */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        padding: "4px 8px",
        fontSize: 10,
        color: "var(--text-muted)",
        background: "rgba(0,0,0,0.3)",
        borderBottomRightRadius: 6,
        zIndex: 100,
        fontFamily: "monospace",
        lineHeight: 1.4,
      }}>
        <div>SeChat</div>
        <div>{"2026-05-16 15:58"}</div>
      </div>
      <div className="auth-logo">{"\u{1F512}"}</div>
      <h1 className="auth-title">SeChat</h1>
      <p className="auth-subtitle">
        Passwordless secure messaging with biometric authentication. Your
        identity is protected by WebAuthn or Microsoft Authenticator.
      </p>

      
{true ? (<>
          {/* Registration Flow */}
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Random Username Display */}
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(45, 156, 219, 0.08)",
                borderRadius: 12,
                textAlign: "center",
                border: "1px solid var(--border)",
              }}
            >
              {registrationTimer > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    color:
                      registrationTimer < 60
                        ? "var(--danger)"
                        : "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  {"\u23F1\uFE0F"} Locked for {formatTimer(registrationTimer)}
                </div>
              )}
            </div>

            {/* Platform detection indicator */}
            {registrationStep === "generating" && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(45, 156, 219, 0.05)",
                  borderRadius: 8,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                {platformIcon} Detected: <strong>{platformName}</strong>
                {isLoading && (
                  <span style={{ marginLeft: 8 }}>
                    {"\u23F3"} Authenticating...
                  </span>
                )}
              </div>
            )}

            {/* TOTP Setup */}
            {registrationStep === "totp" && totpSecret && (
              <div>
                <div
                  style={{
                    padding: 16,
                    background: "#0d0d1a",
                    borderRadius: 12,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="TOTP QR Code"
                      style={{ width: 220, height: 220, borderRadius: 8, margin: "0 auto", display: "block" }}
                    />
                  ) : (
                    <div style={{ fontSize: 14, color: "var(--text-muted)", padding: 20 }}>{"⏳"} Generating QR code...</div>
                  )}
                  <div style={{fontSize:10,color:"var(--text-muted)",textAlign:"center",marginTop:4}}>
                    {"⏱"} QR code expires in {formatTimer(registrationTimer)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 4,
                    }}
                  >
                    1. Open Microsoft Authenticator
                    <br />
                    2. Add account using this QR code or secret
                    <br />
                    3. Enter the 6-digit code below
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    style={{
                      textAlign: "center",
                      fontSize: 20,
                      letterSpacing: 4,
                      fontFamily: "monospace",
                    }}
                    maxLength={6}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={handleVerifyTOTP}
                  disabled={isLoading || totpCode.length < 6}
                  style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading
                    ? "\u23F3 Verifying..."
                    : "\u2705 Verify & Complete Registration"}
                </button>
              </div>
            )}

                        {/* Fallback: manual TOTP trigger if auto-detect didn't work */}
            {registrationStep === "generating" && currentUsername && !isLoading && (
              <button
                onClick={() => {
                  hasAutoDetected.current = true;
                  setupTOTP(currentUsername || "");
                }}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {"📱"} Use Microsoft Authenticator
              </button>
            )}

            {/* Mobile WebAuthn loading state */}
            {registrationStep === "webauthn" && isLoading && (
              <div
                style={{
                  padding: "16px",
                  background: "rgba(45, 156, 219, 0.05)",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>
                  {"\u{1F9BE}"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {"\u23F3"} Checking biometric authentication...
                </div>
              </div>
            )}

            {/* Timer warning */}
            {registrationTimer > 0 && registrationTimer < 60 && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(233, 69, 96, 0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "var(--danger)",
                  textAlign: "center",
                }}
              >
                {"\u26A0\uFE0F"} Username expires in {registrationTimer}{" "}
                seconds! Complete registration to keep it.
              </div>
            )}

            {/* Timer expired */}
            {registrationTimer <= 0 && registrationStep !== "generating" && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(253, 203, 110, 0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "var(--warning)",
                  textAlign: "center",
                }}
              >
                {"\u23F0"} Username expired. A new one will be generated.
                <button
                  onClick={() => {
                    hasAutoStarted.current = false;
                    hasAutoDetected.current = false;
                    startRegistration();
                  }}
                  style={{
                    display: "block",
                    margin: "8px auto 0",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "4px 12px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Generate New Username
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",gap:16}}>
          <input
            className="input-field"
            type="text"
            placeholder="Enter your username"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            autoFocus
          />

          {!showTOTPInput ? (
            <button
              className="btn-primary"
              onClick={handleLogin}
              disabled={isLoading || !loginUsername.trim()}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? "\u23F3 Authenticating..." : "\u{1F510} Login"}
            </button>
          ) : (
            <div>
              <input
                className="input-field"
                type="text"
                placeholder="Enter TOTP code from Microsoft Authenticator"
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                style={{
                  textAlign: "center",
                  fontSize: 20,
                  letterSpacing: 4,
                  fontFamily: "monospace",
                }}
                maxLength={6}
              />
              <button
                className="btn-primary"
                onClick={handleTOTPLogin}
                disabled={isLoading || totpCode.length < 6}
                style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? "\u23F3 Verifying..." : "\u2705 Verify & Login"}
              </button>
              <button
                onClick={() => setShowTOTPInput(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  marginTop: 8,
                  display: "block",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                {"\u2190"} Try WebAuthn instead
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            color: "var(--danger)",
            fontSize: 13,
            textAlign: "center",
            maxWidth: 320,
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}

      {/* Sponsor role display after registration */}
      {currentUser?.sponsorRole && currentUser?.sponsorRole !== "none" && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {"\u{1F3C5}"} Sponsor:{" "}
          </span>
          <RoleBadge
            role={currentUser.sponsorRole as any}
            size="medium"
            showLabel={true}
          />
        </div>
      )}

      {/* Security footer */}
      <div style={{ marginTop: "auto", textAlign: "center", padding: 16 }}>
        <div
          style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}
        >
          <div>
            {"\u{1F6E1}\uFE0F"} Passwordless {"\u{1F510}"} WebAuthn + TOTP
          </div>
          <div>
            {"\u{1F464}"} Anonymous ID {"\u{1F512}"} 5-min
            registration lock
          </div>
          <div>{"\u{1F4F1}"} Microsoft Authenticator compatible</div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useStore } from "../store/useStore";

export default function VoiceCall() {
  const callState = useStore((s) => s.callState);
  const endCall = useStore((s) => s.endCall);
  const toggleMute = useStore((s) => s.toggleMute);
  const toggleSpeaker = useStore((s) => s.toggleSpeaker);
  const setCallState = useStore((s) => s.setCallState);
  const [displayDuration, setDisplayDuration] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const timerRef = useRef<number>(0);
  const endTimerRef = useRef<number>(0);

  // Handle call timer
  useEffect(() => {
    if (callState.status === "connected") {
      timerRef.current = window.setInterval(() => {
        setDisplayDuration((prev) => prev + 1);
      }, 1000);
    } else if (callState.status === "ended") {
      clearInterval(timerRef.current);
      setIsAnimatingOut(true);
      endTimerRef.current = window.setTimeout(() => {
        setCallState({
          status: "idle",
          active: false,
          duration: 0,
          withUserId: undefined,
          withUserName: undefined,
        });
        setIsAnimatingOut(false);
        setDisplayDuration(0);
      }, 2000);
    }
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(endTimerRef.current);
    };
  }, [callState.status, setCallState]);

  // Handle incoming call simulation
  useEffect(() => {
    if (callState.status === "calling") {
      const timeout = setTimeout(() => {
        setCallState({ status: "ringing" });
        const connectTimeout = setTimeout(() => {
          setCallState({ status: "connected" });
        }, 2000);
        return () => clearTimeout(connectTimeout);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [callState.status, setCallState]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getStatusText = (): string => {
    switch (callState.status) {
      case "calling":
        return "Calling...";
      case "ringing":
        return "Ringing...";
      case "connected":
        return "Connected";
      case "ended":
        return "Call Ended";
      default:
        return "";
    }
  };

  const getStatusIcon = (): string => {
    switch (callState.status) {
      case "calling":
        return "📞";
      case "ringing":
        return "🔔";
      case "connected":
        return "🟢";
      case "ended":
        return "🔴";
      default:
        return "";
    }
  };

  // If not active, don't render anything
  if (!callState.active && callState.status === "idle") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        animation: isAnimatingOut
          ? "callFadeOut 0.4s ease-out forwards"
          : "callFadeIn 0.4s ease-out",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
      }}
    >
      <style>{`
        @keyframes callFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes callFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.95); }
        }
        @keyframes callPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes callRipple {
          0% { box-shadow: 0 0 0 0 rgba(45, 156, 219, 0.4); }
          100% { box-shadow: 0 0 0 40px rgba(45, 156, 219, 0); }
        }
        @keyframes callSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Background gradient circles */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(45, 156, 219, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Status indicator */}
      <div
        style={{
          position: "absolute",
          top: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          animation: "callSlideUp 0.5s ease-out 0.1s both",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color:
              callState.status === "connected"
                ? "var(--success, #00b894)"
                : callState.status === "ended"
                  ? "var(--danger, #e94560)"
                  : "var(--text-secondary, #8899aa)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,
          }}
        >
          <span>{getStatusIcon()}</span>
          <span>{getStatusText()}</span>
        </div>

        {callState.status === "connected" && (
          <div
            style={{
              fontSize: 40,
              fontWeight: 200,
              color: "#fff",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: 2,
            }}
          >
            {formatDuration(displayDuration)}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, var(--accent, #2d9cdb), #6c5ce7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          fontWeight: 600,
          color: "#fff",
          animation:
            callState.status === "calling" || callState.status === "ringing"
              ? "callPulse 1.5s ease-in-out infinite, callRipple 2s ease-out infinite"
              : "none",
          boxShadow: "0 8px 40px rgba(45, 156, 219, 0.3)",
          marginBottom: 16,
          position: "relative",
        }}
      >
        {callState.withUserName?.charAt(0)?.toUpperCase() || "?"}
      </div>

      {/* Caller name */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "#fff",
          marginBottom: 8,
          animation: "callSlideUp 0.5s ease-out 0.2s both",
        }}
      >
        {callState.withUserName || "Unknown"}
      </div>

      {/* Encryption indicator */}
      <div
        style={{
          fontSize: 12,
          color: "var(--success, #00b894)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 48,
          animation: "callSlideUp 0.5s ease-out 0.3s both",
        }}
      >
        <span>🔐</span>
        <span>End-to-End Encrypted</span>
      </div>

      {/* Call Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          animation: "callSlideUp 0.5s ease-out 0.4s both",
        }}
      >
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            background: callState.isMuted
              ? "rgba(233, 69, 96, 0.2)"
              : "rgba(255, 255, 255, 0.08)",
            color: callState.isMuted ? "var(--danger, #e94560)" : "#fff",
            fontSize: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            position: "relative",
          }}
          title={callState.isMuted ? "Unmute" : "Mute"}
        >
          {callState.isMuted ? "🔇" : "🎤"}
          {callState.isMuted && (
            <div
              style={{
                position: "absolute",
                bottom: -20,
                fontSize: 10,
                color: "var(--danger, #e94560)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Muted
            </div>
          )}
        </button>

        {/* End Call Button */}
        <button
          onClick={() => {
            endCall();
          }}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: "none",
            background: "var(--danger, #e94560)",
            color: "#fff",
            fontSize: 32,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: "0 4px 20px rgba(233, 69, 96, 0.4)",
          }}
          title="End Call"
        >
          📞
        </button>

        {/* Speaker Button */}
        <button
          onClick={toggleSpeaker}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            background: callState.isSpeakerOn
              ? "rgba(0, 184, 148, 0.2)"
              : "rgba(255, 255, 255, 0.08)",
            color: callState.isSpeakerOn ? "var(--success, #00b894)" : "#fff",
            fontSize: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            position: "relative",
          }}
          title={callState.isSpeakerOn ? "Speaker Off" : "Speaker On"}
        >
          {callState.isSpeakerOn ? "🔊" : "🔉"}
          {callState.isSpeakerOn && (
            <div
              style={{
                position: "absolute",
                bottom: -20,
                fontSize: 10,
                color: "var(--success, #00b894)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Speaker
            </div>
          )}
        </button>
      </div>

      {/* Call end text */}
      {callState.status === "ended" && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            fontSize: 13,
            color: "var(--text-muted, #5a6a7a)",
            animation: "callSlideUp 0.3s ease-out",
          }}
        >
          {displayDuration > 0
            ? `Call duration: ${formatDuration(displayDuration)}`
            : "Call cancelled"}
        </div>
      )}
    </div>
  );
}

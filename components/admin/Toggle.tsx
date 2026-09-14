"use client";

interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  title?: string;
}

export default function Toggle({ checked, onChange, disabled, title }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        width: "2.25rem",
        height: "1.25rem",
        borderRadius: "9999px",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        padding: "0.15rem",
        background: checked ? "var(--primary)" : "var(--border)",
        transition: "background 0.2s",
      }}
    >
      <span style={{
        display: "block",
        width: "0.9rem",
        height: "0.9rem",
        borderRadius: "50%",
        background: "#fff",
        transform: checked ? "translateX(1rem)" : "translateX(0)",
        transition: "transform 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

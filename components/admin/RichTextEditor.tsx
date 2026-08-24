"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.3rem 0.6rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "var(--btn-text)" : "var(--text)",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          Fett
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • Liste
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. Liste
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="ew-rich-editor" />
    </div>
  );
}

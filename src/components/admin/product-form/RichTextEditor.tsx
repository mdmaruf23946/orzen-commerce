import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Undo, Redo, Heading2, Quote } from "lucide-react";

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-32 rounded-md border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-ring",
      },
    },
    onUpdate: ({ editor }) => {
      if (editor.isDestroyed) return;
      try {
        onChange(editor.getHTML());
      } catch {
        /* editor tearing down */
      }
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      if (value !== editor.getHTML()) {
        editor.commands.setContent(value || "", { emitUpdate: false });
      }
    } catch {
      /* editor not ready or destroyed */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;
  const btn = (active: boolean) =>
    `rounded p-1.5 text-xs hover:bg-muted ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading"><Heading2 className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list"><List className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Ordered list"><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote"><Quote className="h-3.5 w-3.5" /></button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()} aria-label="Undo"><Undo className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()} aria-label="Redo"><Redo className="h-3.5 w-3.5" /></button>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

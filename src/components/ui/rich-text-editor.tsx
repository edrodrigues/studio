"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Table as TableIcon,
    PlusSquare,
    Trash2,
    Columns,
    Rows
} from "lucide-react";
import { Button } from "./button";
import { Separator } from "./separator";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/50">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(editor.isActive("bold") && "bg-accent")}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(editor.isActive("italic") && "bg-accent")}
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(editor.isActive("bulletList") && "bg-accent")}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(editor.isActive("orderedList") && "bg-accent")}
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
                <PlusSquare className="h-4 w-4 mr-1" /> <TableIcon className="h-4 w-4" />
            </Button>
            {editor.isActive('table') && (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        title="Adicionar Coluna Antes"
                    >
                        <Columns className="h-4 w-4 mr-1 rotate-180" /> +
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        title="Adicionar Coluna Depois"
                    >
                        <Columns className="h-4 w-4 mr-1" /> +
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                        title="Deletar Coluna"
                    >
                        <Columns className="h-4 w-4 mr-1 text-destructive" /> -
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                        title="Adicionar Linha Antes"
                    >
                        <Rows className="h-4 w-4 mr-1 rotate-180" /> +
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        title="Adicionar Linha Depois"
                    >
                        <Rows className="h-4 w-4 mr-1" /> +
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().deleteRow().run()}
                        title="Deletar Linha"
                    >
                        <Rows className="h-4 w-4 mr-1 text-destructive" /> -
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        className="text-destructive hover:bg-destructive/10"
                        title="Deletar Tabela"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </>
            )}
            <div className="flex-1" />
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
};

export function RichTextEditor({
    value,
    onChange,
    placeholder,
    className,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            // Get content as Markdown
            const markdown = (editor.storage as any).markdown?.getMarkdown();
            if (markdown !== undefined) {
                onChange(markdown);
            }
        },
        editorProps: {
            attributes: {
                class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4",
            },
        },
    });

    // Update editor content when value prop changes externally
    useEffect(() => {
        if (editor) {
            const currentMarkdown = (editor.storage as any).markdown?.getMarkdown();
            if (value !== currentMarkdown) {
                editor.commands.setContent(value, { emitUpdate: false });
            }
        }
    }, [value, editor]);

    return (
        <div className={cn("border rounded-md bg-background flex flex-col", className)}>
            <MenuBar editor={editor} />
            <div className="flex-1 overflow-y-auto">
                <EditorContent editor={editor} />
            </div>
            <style jsx global>{`
                .tiptap table {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                    margin: 0;
                    overflow: hidden;
                }
                .tiptap table td,
                .tiptap table th {
                    min-width: 1em;
                    border: 1px solid #ced4da;
                    padding: 3px 5px;
                    vertical-align: top;
                    box-sizing: border-box;
                    position: relative;
                }
                .tiptap table th {
                    font-weight: bold;
                    text-align: left;
                    background-color: rgba(0, 0, 0, 0.05);
                }
                .tiptap table .selectedCell:after {
                    z-index: 2;
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    background: rgba(200, 200, 255, 0.4);
                    pointer-events: none;
                }
                .tiptap table .column-resize-handle {
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: -2px;
                    width: 4px;
                    background-color: #adf;
                    pointer-events: none;
                }
                .tiptap table p {
                    margin: 0;
                }
            `}</style>
        </div>
    );
}


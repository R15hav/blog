"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentFormattedDate } from "../_lib/utility";
import { verifyToken, createArticle, updateArticle } from "../_lib/api_callout";

import EditorJS from "@editorjs/editorjs";
import Embed from "@editorjs/embed";
import Table from "@editorjs/table";
import List from "@editorjs/list";
import Warning from "@editorjs/warning";
import Code from "@editorjs/code";
import Raw from "@editorjs/raw";
import Header from "@editorjs/header";
import Quote from "@editorjs/quote";
import Marker from "@editorjs/marker";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import SimpleImage from "@editorjs/simple-image";
import Alert from "editorjs-alert";

class SimpleImageTool extends SimpleImage {
    static get toolbox() {
        return {
            title: "Image",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.5" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 16l4-4 3 3 2-2 4 4"/></svg>`,
        };
    }

    render() {
        if (this.data.url) return super.render();

        const wrapper = this._make("div", [this.CSS.baseClass, this.CSS.wrapper]);
        const input = document.createElement("input");
        input.type = "url";
        input.placeholder = "Paste image URL and press Enter…";
        Object.assign(input.style, {
            width: "100%", padding: "8px 12px", border: "1px dashed #ccc",
            borderRadius: "4px", outline: "none", fontSize: "14px",
        });

        input.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const url = input.value.trim();
            if (!url) return;
            this.data = { url };
            const rendered = super.render();
            wrapper.replaceWith(rendered);
            this.nodes.wrapper = rendered;
        });

        this.nodes.wrapper = wrapper;
        wrapper.appendChild(input);
        setTimeout(() => input.focus(), 50);
        return wrapper;
    }
}

const TOOLS = {
    embed: Embed,
    table: Table,
    marker: Marker,
    list: List,
    warning: Warning,
    code: Code,
    raw: Raw,
    header: Header,
    quote: Quote,
    delimiter: Delimiter,
    inlineCode: InlineCode,
    simpleImage: SimpleImageTool,
    alert: Alert,
};

function Editorjs({ id, initialData = null, initialTitle = "", initialPublished = true }) {
    const router = useRouter();
    const editorRef = useRef(null);

    const [title, setTitle] = useState(initialTitle);
    const [published, setPublished] = useState(initialPublished);
    const [statusMsg, setStatusMsg] = useState(null);
    const [statusType, setStatusType] = useState(null);

    useEffect(() => {
        if (editorRef.current) return;

        editorRef.current = new EditorJS({
            holder: "editorjs",
            tools: TOOLS,
            data: initialData ?? {},
        });

        return () => {
            const editor = editorRef.current;
            editorRef.current = null;
            editor?.isReady.then(() => editor.destroy()).catch(() => {});
        };
    }, []);

    const save = async () => {
        setStatusMsg(null);
        setStatusType(null);
        try {
            if (!editorRef.current) { setStatusMsg("Editor not ready. Please wait."); setStatusType("err"); return; }

            const token = localStorage.getItem("access_token");
            if (!token) { setStatusMsg("Not logged in."); setStatusType("err"); return; }

            const { valid } = await verifyToken(token);
            if (!valid) { setStatusMsg("Session expired. Please login again."); setStatusType("err"); return; }

            await editorRef.current.isReady;
            const outputData = await editorRef.current.save();

            const payload = {
                title: title.trim(),
                content: JSON.stringify(outputData),
                published: Boolean(published),
                created_date: getCurrentFormattedDate(),
            };

            const res = id
                ? await updateArticle(id, payload, token)
                : await createArticle(payload, token);

            if (!res.success) {
                setStatusMsg(`Save failed: ${JSON.stringify(res.detail)}`);
                setStatusType("err");
                return;
            }
            setStatusMsg(id ? "Article updated." : "Article created.");
            setStatusType("ok");
            if (!id) router.push("/");
        } catch (err) {
            setStatusMsg("Save error: " + (err?.message ?? String(err)));
            setStatusType("err");
        }
    };

    return (
        <div className="editor-shell">
            <div className="editor-toolbar">
                <a className="nav-link" href="/">← Back</a>
                <div className="editor-toolbar-right">
                    <label className="editor-publish-toggle">
                        <input
                            type="checkbox"
                            checked={published}
                            onChange={(e) => setPublished(e.target.checked)}
                        />
                        Published
                    </label>
                    <button className="btn btn-primary btn-sm" onClick={save}>
                        Save
                    </button>
                </div>
            </div>

            {statusMsg && (
                <p className={`editor-status${statusType ? ` ${statusType}` : ""}`}>
                    {statusMsg}
                </p>
            )}

            <input
                type="text"
                className="editor-title"
                placeholder="Article title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />

            <div id="editorjs" className="editor-body" />
        </div>
    );
}

export default Editorjs;

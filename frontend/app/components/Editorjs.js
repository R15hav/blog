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
import CheckList from "@editorjs/checklist";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import SimpleImage from "@editorjs/simple-image";

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
    checklist: CheckList,
    delimiter: Delimiter,
    inlineCode: InlineCode,
    simpleImage: SimpleImage,
};

function Editorjs({ id, initialData = null, initialTitle = "", initialPublished = true }) {
    const router = useRouter();
    const editorRef = useRef(null);

    const [title, setTitle] = useState(initialTitle);
    const [published, setPublished] = useState(initialPublished);
    const [statusMsg, setStatusMsg] = useState(null);

    useEffect(() => {
        if (editorRef.current) return;

        editorRef.current = new EditorJS({
            holder: "editorjs",
            tools: TOOLS,
            data: initialData ?? {},
        });

        return () => {
            // Null synchronously so a re-mount correctly reinitialises
            const editor = editorRef.current;
            editorRef.current = null;
            editor?.isReady.then(() => editor.destroy()).catch(() => {});
        };
    }, []);

    const save = async () => {
        setStatusMsg(null);
        try {
            if (!editorRef.current) { setStatusMsg("Editor not ready. Please wait."); return; }

            const token = localStorage.getItem("access_token");
            if (!token) { setStatusMsg("Not logged in."); return; }

            const { valid } = await verifyToken(token);
            if (!valid) { setStatusMsg("Session expired. Please login again."); return; }

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
                return;
            }
            setStatusMsg(id ? "Article updated." : "Article created.");
            if (!id) router.push("/");
        } catch (err) {
            setStatusMsg("Save error: " + (err?.message ?? String(err)));
        }
    };

    return (
        <div className="editor-container">
            <input
                type="text"
                className="editor-title"
                placeholder="Article title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <label className="editor-publish-label">
                <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                />
                {" Published"}
            </label>
            <div id="editorjs" className="editor-body" />
            <button onClick={save}>Save</button>
            {statusMsg && <p>{statusMsg}</p>}
        </div>
    );
}

export default Editorjs;

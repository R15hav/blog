"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { getCurrentFormattedDate } from "../_lib/utility";
import { verifyToken, createArticle, updateArticle, getArticle } from "../_lib/api_callout";

import EditorJS from "@editorjs/editorjs";
import Embed from "@editorjs/embed";
import Table from "@editorjs/table";
import List from "@editorjs/list";
import Warning from "@editorjs/warning";
import Code from "@editorjs/code";
import LinkTool from "@editorjs/link";
import Raw from "@editorjs/raw";
import Header from "@editorjs/header";
import Quote from "@editorjs/quote";
import Marker from "@editorjs/marker";
import CheckList from "@editorjs/checklist";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import SimpleImage from "@editorjs/simple-image";

function Editorjs({ id }) {
    const router = useRouter();
    const editorInstance = useRef(null);
    const initialData = useRef(null);

    const [title, setTitle] = useState("");
    const [published, setPublished] = useState(true);
    const [statusMsg, setStatusMsg] = useState(null);
    const [loading, setLoading] = useState(!!id);

    function initEditor(data) {
        if (editorInstance.current) return;
        editorInstance.current = new EditorJS({
            holder: "editorjs",
            tools: {
                embed: Embed,
                table: Table,
                marker: Marker,
                list: List,
                warning: Warning,
                code: Code,
                linkTool: LinkTool,
                raw: Raw,
                header: Header,
                quote: Quote,
                checklist: CheckList,
                delimiter: Delimiter,
                inlineCode: InlineCode,
                simpleImage: SimpleImage,
            },
            data: data ?? {},
            onReady: () => {},
        });
    }

    useEffect(() => {
        if (!id) {
            initEditor(null);
            return;
        }
        getArticle(id).then(({ success, detail }) => {
            if (success && detail?.article?.[0]) {
                const article = detail.article[0];
                setTitle(article.title ?? "");
                setPublished(article.published === true || article.published === "true");
                try {
                    initialData.current = JSON.parse(article.content);
                } catch {
                    initialData.current = null;
                }
            }
            setLoading(false);
            initEditor(initialData.current);
        });
    }, [id]);

    const save = async () => {
        setStatusMsg(null);
        try {
            const token = localStorage.getItem("access_token");
            if (!token) {
                setStatusMsg("Not logged in. Please login first.");
                return;
            }
            const { valid } = await verifyToken(token);
            if (!valid) {
                setStatusMsg("Session expired. Please login again.");
                return;
            }
            const outputData = await editorInstance.current.save();
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

    if (loading) return <p>Loading article…</p>;

    return (
        <div>
            <input
                type="text"
                placeholder="Article title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ display: "block", width: "100%", fontSize: "1.5em", marginBottom: "1em" }}
            />
            <label>
                <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                />
                {" Published"}
            </label>
            <div id="editorjs" style={{ border: "1px solid #ccc", minHeight: "200px", padding: "8px" }} />
            <button onClick={save}>Save</button>
            {statusMsg && <p>{statusMsg}</p>}
        </div>
    );
}

export default Editorjs;

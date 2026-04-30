"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
    getLikeStatus,
    toggleLike,
    getComments,
    addComment,
    deleteComment,
} from "../../_lib/api_callout";

function initials(email) {
    return email ? email[0].toUpperCase() : "?";
}

function countWords(blocks) {
    if (!blocks) return 0;
    let n = 0;
    for (const b of blocks) {
        if (b.type === "paragraph" || b.type === "header") {
            n += (b.data?.text ?? "").replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length;
        }
        if (b.type === "list") {
            for (const item of b.data?.items ?? []) {
                const t = (typeof item === "string" ? item : item?.content ?? "").replace(/<[^>]+>/g, "");
                n += t.trim().split(/\s+/).filter(Boolean).length;
            }
        }
    }
    return n;
}

export default function ArticleInteractions({ articleId, authorEmail, blocks, createdDate, hideByline = false }) {
    const { user, token } = useAuth();

    const [likeCount, setLikeCount] = useState(0);
    const [userLiked, setUserLiked] = useState(false);
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const [commentBody, setCommentBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [shareMsg, setShareMsg] = useState("");
    const commentsRef = useRef(null);

    const readTime = Math.max(1, Math.ceil(countWords(blocks) / 200));
    const dateStr = createdDate
        ? new Date(createdDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "";

    useEffect(() => {
        getLikeStatus(articleId, token).then((res) => {
            if (res.success) {
                setLikeCount(res.detail.count ?? 0);
                setUserLiked(res.detail.user_liked ?? false);
            }
        });
        getComments(articleId).then((res) => {
            if (res.success) setComments(res.detail ?? []);
        });
    }, [articleId, token]);

    async function handleLike() {
        if (!token) { window.location.href = "/login"; return; }
        const res = await toggleLike(articleId, token);
        if (res.success) {
            setLikeCount(res.detail.count ?? 0);
            setUserLiked(res.detail.user_liked ?? false);
        }
    }

    async function handleShare() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setShareMsg("Copied!");
        } catch {
            setShareMsg("Error");
        }
        setTimeout(() => setShareMsg(""), 2000);
    }

    function handleCommentToggle() {
        setShowComments((v) => {
            if (!v) setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            return !v;
        });
    }

    async function handleSubmitComment(e) {
        e.preventDefault();
        if (!commentBody.trim()) return;
        setSubmitting(true);
        const res = await addComment(articleId, commentBody.trim(), token);
        if (res.success) {
            setComments((prev) => [...prev, res.detail]);
            setCommentBody("");
        }
        setSubmitting(false);
    }

    async function handleDeleteComment(cid) {
        const res = await deleteComment(articleId, cid, token);
        if (res.success) setComments((prev) => prev.filter((c) => c.id !== cid));
    }

    return (
        <div className="article-interactions">
            {/* Author byline */}
            {!hideByline && (
                <div className="article-author">
                    <div className="article-author__avatar">{initials(authorEmail)}</div>
                    <div>
                        <div className="article-author__name">{authorEmail ?? "Unknown"}</div>
                        <div className="article-author__meta">{readTime} min read · {dateStr}</div>
                    </div>
                </div>
            )}

            {/* Reactions bar */}
            <div className="article-reactions">
                <button
                    className={`reaction-btn${userLiked ? " reaction-btn--liked" : ""}`}
                    onClick={handleLike}
                    aria-label="Like article"
                >
                    <span role="img" aria-hidden="true">👏</span>
                    <span className="reaction-btn__count">{likeCount}</span>
                </button>
                <button className="reaction-btn" onClick={handleCommentToggle} aria-label="Toggle comments">
                    <span role="img" aria-hidden="true">💬</span>
                    <span className="reaction-btn__count">{comments.length}</span>
                </button>
                <button className="reaction-btn" onClick={handleShare} aria-label="Share article">
                    <span role="img" aria-hidden="true">🔗</span>
                    {shareMsg && <span className="reaction-btn__toast">{shareMsg}</span>}
                </button>
            </div>

            {/* Comments section */}
            {showComments && (
                <div className="comments-section" ref={commentsRef}>
                    <h3>Comments</h3>
                    {comments.length === 0 && (
                        <p className="comments-empty">No comments yet. Be the first!</p>
                    )}
                    {comments.map((c) => (
                        <div key={c.id} className="comment">
                            <div className="comment__avatar">{initials(c.author_email)}</div>
                            <div className="comment__body">
                                <strong>{c.author_email}</strong>
                                <p>{c.body}</p>
                                <span className="comment__date">
                                    {new Date(c.created_at).toLocaleDateString()}
                                </span>
                                {(user?.email === c.author_email || user?.is_superuser) && (
                                    <button
                                        className="comment__delete"
                                        onClick={() => handleDeleteComment(c.id)}
                                        aria-label="Delete comment"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {user ? (
                        <form className="comment-form" onSubmit={handleSubmitComment}>
                            <textarea
                                value={commentBody}
                                onChange={(e) => setCommentBody(e.target.value)}
                                placeholder="Write a comment…"
                                rows={3}
                                required
                            />
                            <button type="submit" disabled={submitting}>
                                {submitting ? "Posting…" : "Post"}
                            </button>
                        </form>
                    ) : (
                        <p className="comment-login">
                            <a href="/login">Login to comment</a>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

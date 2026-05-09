const API = process.env.NEXT_PUBLIC_API_URL || "";

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function verifyToken(token) {
    const res = await fetch(`${API}/users/me`, {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
        },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { valid: true, detail: data } : { valid: false, detail: data };
}

// ── Articles ───────────────────────────────────────────────────────────────────

export async function getArticles({ skip = 0, limit = 10, search = "" } = {}) {
    const params = new URLSearchParams({ skip, limit });
    if (search) params.set("q", search);
    const res = await fetch(`${API}/api/v1/get-articles?${params}`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function getArticle(id) {
    const res = await fetch(`${API}/api/v1/get-article/${id}`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function searchArticles(title) {
    const res = await fetch(`${API}/api/v1/search-articles?title=${encodeURIComponent(title)}`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function createArticle(payload, token) {
    const res = await fetch(`${API}/api/v1/create-article`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function updateArticle(articleId, payload, token) {
    const res = await fetch(`${API}/api/v1/update-article/${articleId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function deleteArticle(articleId, token) {
    const res = await fetch(`${API}/api/v1/delete-article/${articleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Public theme ───────────────────────────────────────────────────────────────

export async function getActiveTheme() {
    const res = await fetch(`${API}/api/v1/theme/active`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: null };
}

// ── Admin — users ──────────────────────────────────────────────────────────────

export async function getUsers(token, { skip = 0, limit = 20, search = "" } = {}) {
    const params = new URLSearchParams({ skip, limit });
    if (search) params.set("q", search);
    const res = await fetch(`${API}/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function activateUser(userId, token) {
    const res = await fetch(`${API}/api/v1/admin/users/${userId}/activate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function deactivateUser(userId, token) {
    const res = await fetch(`${API}/api/v1/admin/users/${userId}/deactivate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function setUserRole(userId, role, token) {
    const res = await fetch(`${API}/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Admin — themes ─────────────────────────────────────────────────────────────

export async function getThemes(token) {
    const res = await fetch(`${API}/api/v1/admin/themes`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function createTheme(name, url, token) {
    const res = await fetch(`${API}/api/v1/admin/themes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, url }),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function activateTheme(themeId, token) {
    const res = await fetch(`${API}/api/v1/admin/themes/${themeId}/activate`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function deleteTheme(themeId, token) {
    const res = await fetch(`${API}/api/v1/admin/themes/${themeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Admin — dashboard stats ────────────────────────────────────────────────────

export async function getAdminStats(token) {
    const res = await fetch(`${API}/api/v1/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Admin — site settings ──────────────────────────────────────────────────────

export async function getAdminSettings(token) {
    const res = await fetch(`${API}/api/v1/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function updateAdminSettings(payload, token) {
    const res = await fetch(`${API}/api/v1/admin/settings`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function uploadLogo(file, token) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/v1/admin/upload-logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Public site settings ───────────────────────────────────────────────────────

export async function getSiteSettings() {
    const res = await fetch(`${API}/api/v1/settings`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: null };
}

// ── Likes ──────────────────────────────────────────────────────────────────────

export async function getLikeStatus(articleId, token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/api/v1/articles/${articleId}/likes`, { headers });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function toggleLike(articleId, token) {
    const res = await fetch(`${API}/api/v1/articles/${articleId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Comments ───────────────────────────────────────────────────────────────────

export async function getComments(articleId) {
    const res = await fetch(`${API}/api/v1/articles/${articleId}/comments`);
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function addComment(articleId, body, token) {
    const res = await fetch(`${API}/api/v1/articles/${articleId}/comments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function deleteComment(articleId, commentId, token) {
    const res = await fetch(`${API}/api/v1/articles/${articleId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Author dashboard ───────────────────────────────────────────────────────────

export async function getAuthorStats(token) {
    const res = await fetch(`${API}/api/v1/author/stats`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function getAuthorArticles(token, { skip = 0, limit = 20, search = "" } = {}) {
    const params = new URLSearchParams({ skip, limit });
    if (search) params.set("q", search);
    const res = await fetch(`${API}/api/v1/author/articles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function getAuthorComments(token, { skip = 0, limit = 50 } = {}) {
    const params = new URLSearchParams({ skip, limit });
    const res = await fetch(`${API}/api/v1/author/comments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function getAdminArticles(token, { skip = 0, limit = 20, search = "" } = {}) {
    const params = new URLSearchParams({ skip, limit });
    if (search) params.set("q", search);
    const res = await fetch(`${API}/api/v1/admin/articles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function getAdminComments(token, { skip = 0, limit = 50, search = "" } = {}) {
    const params = new URLSearchParams({ skip, limit });
    if (search) params.set("q", search);
    const res = await fetch(`${API}/api/v1/admin/comments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

// ── Profile ────────────────────────────────────────────────────────────────────

export async function getMyProfile(token) {
    const res = await fetch(`${API}/api/v1/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: data } : { success: false, detail: data };
}

export async function updateMyProfile(data, token) {
    const res = await fetch(`${API}/api/v1/profile/me`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function addExperience(data, token) {
    const res = await fetch(`${API}/api/v1/profile/experience`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function updateExperience(id, data, token) {
    const res = await fetch(`${API}/api/v1/profile/experience/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function deleteExperience(id, token) {
    const res = await fetch(`${API}/api/v1/profile/experience/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function addQualification(data, token) {
    const res = await fetch(`${API}/api/v1/profile/qualification`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function updateQualification(id, data, token) {
    const res = await fetch(`${API}/api/v1/profile/qualification/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function deleteQualification(id, token) {
    const res = await fetch(`${API}/api/v1/profile/qualification/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function upsertSchool(data, token) {
    const res = await fetch(`${API}/api/v1/profile/school`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

export async function deleteSchool(id, token) {
    const res = await fetch(`${API}/api/v1/profile/school/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { success: true, detail: body } : { success: false, detail: body };
}

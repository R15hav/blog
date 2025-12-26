export async function verifyToken(token) {
    const res = await fetch('http://localhost:8000/users/me', {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    const data = await res.json().catch(() => null)
    if (!res.ok) {
        return { valid: false, detail: data };
    }
    return { valid: true, detail: data };
}

export async function createArticle(payload, token) {
    const res = await fetch('http://localhost:8000/api/v1/create-article', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null)
    if (!res.ok) {
        return { success: false, detail: data };
    }
    return { success: true, detail: data };
}

export async function updateArticle(articleId, payload, token) {
    const res = await fetch(`http://localhost:8000/api/v1/update-article/${articleId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null)
    if (!res.ok) {
        return { success: false, detail: data };
    }
    return { success: true, detail: data };
}
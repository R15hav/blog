export async function verifyToken(token) {
    const body = { token: token };
    const res = await fetch('http://localhost:8000/auth/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null)
    if (!res.ok) {
        return { valid: false, detail: data };
    }
    return { valid: true, detail: data };
}
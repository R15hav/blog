
export function getTokenFromLocalStorage() {
    // infer owner_id from localStorage or JWT payload if available
    let owner_id = null
    let token = null

    try {
        token = localStorage.getItem('access_token')

        if (!token) {
            throw new Error('No access token found. Please login first.');
        }

        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        owner_id = payload.sub || payload.user_id || payload.id || null

    } catch (e) {
        throw new Error("Error parsing JWT payload");
    } finally {
        return { owner_id, token }
    }
}

export function getCurrentFormattedDate() {
    const pad = (n) => String(n).padStart(2, '0')
    const d = new Date()
    const created_date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    return created_date
}
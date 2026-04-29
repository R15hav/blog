"use client";
import BackButton from "../../components/BackButton";

export default function AdminDashboard() {
    return (
        <div>
            <BackButton />
            <h1>Admin Dashboard</h1>
            <ul>
                <li><a href="/admin/users">User Management</a></li>
                <li><a href="/admin/articles">Articles</a></li>
                <li><a href="/admin/theme">Theme</a></li>
            </ul>
        </div>
    );
}

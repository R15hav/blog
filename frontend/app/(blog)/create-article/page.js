"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "../../context/AuthContext";

const DynamicEditorjs = dynamic(() => import("../../components/Editorjs"), {
  ssr: false,
});

function page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = user?.is_superuser || ["author", "admin"].includes(user?.role);

  useEffect(() => {
    if (loading) return;
    if (!user || !allowed) router.replace("/login");
  }, [user, loading, allowed, router]);

  if (loading || !user || !allowed) return null;

  return (
    <div>
      Editor Page
      <DynamicEditorjs />
    </div>
  );
}

export default page;

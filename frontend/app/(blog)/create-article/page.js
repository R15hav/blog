"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "../../context/AuthContext";
import BackButton from "../../components/BackButton";

const DynamicEditorjs = dynamic(() => import("../../components/Editorjs"), {
  ssr: false,
});

function page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !["author", "admin"].includes(user.role)) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || !["author", "admin"].includes(user.role)) {
    return null;
  }

  return (
    <div>
      <BackButton />
      Editor Page
      <DynamicEditorjs />
    </div>
  );
}

export default page;

import { getAllowRegistration, getSiteName } from "../../_lib/theme";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const [allowRegistration, siteName] = await Promise.all([
    getAllowRegistration(),
    getSiteName(),
  ]);
  return <LoginForm allowRegistration={allowRegistration} siteName={siteName} />;
}

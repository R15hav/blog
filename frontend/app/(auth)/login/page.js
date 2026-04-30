import { getAllowRegistration } from "../../_lib/theme";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const allowRegistration = await getAllowRegistration();
  return <LoginForm allowRegistration={allowRegistration} />;
}

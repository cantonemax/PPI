import { redirect } from "next/navigation";

export default function NewOrderPage() {
  redirect("/dashboard/orders?view=create");
}

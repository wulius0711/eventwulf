import InviteAcceptForm from "@/components/admin/InviteAcceptForm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  return <InviteAcceptForm token={token} />;
}

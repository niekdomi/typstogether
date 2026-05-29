import { useNavigate, useParams } from "@solidjs/router";
import { onMount } from "solid-js";
import { toast } from "somoto";

import { api, apiErrorMessage } from "../lib/api";

export default function RedeemInvite() {
  const params = useParams<{ token: string }>();
  const navigate = useNavigate();

  onMount(() => {
    void (async () => {
      const { data, error } = await api.invites({ token: params.token }).redeem.post();
      if (error) {
        toast.error(apiErrorMessage(error, "This invite link is invalid or expired."));
        navigate("/dashboard");
        return;
      }
      toast.success(`Joined ${data.project.name}.`);
      navigate(`/project/${data.project.id}`);
    })();
  });

  return <p class="loading">Joining…</p>;
}

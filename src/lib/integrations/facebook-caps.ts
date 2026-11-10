// Client-safe mirror of the capability -> Meta permission map.
// Kept separate from facebook-page.server.ts so the admin UI can import it.
export const CAP_SCOPE: Record<string, string> = {
  read_posts: "pages_read_engagement",
  create_post: "pages_manage_posts",
  edit_post: "pages_manage_posts",
  delete_post: "pages_manage_posts",
  read_comments: "pages_read_engagement",
  reply_comment: "pages_manage_engagement",
  hide_comment: "pages_manage_engagement",
  delete_comment: "pages_manage_engagement",
  block_user: "pages_manage_metadata",
  private_reply: "pages_messaging",
};

export const CAP_LABEL: Record<string, string> = {
  read_posts: "Read posts",
  create_post: "Create posts",
  edit_post: "Edit posts",
  delete_post: "Delete posts",
  read_comments: "Read comments",
  reply_comment: "Reply to comments",
  hide_comment: "Hide comments",
  delete_comment: "Delete comments",
  block_user: "Block users",
  private_reply: "Message on Messenger",
};

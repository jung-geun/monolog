export type TComment = {
  id: string
  slug: string
  postId: string
  nickname: string
  body: string
  createdAt: string
}

export type TCommentCreateInput = {
  slug: string
  postId: string
  body: string
  ipHash: string
  nickname: string
}

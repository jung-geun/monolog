import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import PostCard from "src/routes/Feed/PostList/PostCard"
import { DEFAULT_CATEGORY } from "src/constants"
import usePostsQuery from "src/hooks/usePostsQuery"

type Props = {
  q: string
}

const PostList: React.FC<Props> = ({ q }) => {
  const router = useRouter()
  const data = usePostsQuery()
  const [filteredPosts, setFilteredPosts] = useState(data)

  const currentTag = `${router.query.tag || ``}` || undefined
  const currentCategory = `${router.query.category || ``}` || DEFAULT_CATEGORY
  const currentOrder = `${router.query.order || ``}` || "desc"

  const STORAGE_KEY = 'feed.filters'

  // Restored from sessionStorage after hydration — always null on first render
  // to keep SSR and client output identical.
  const [restoredFilters, setRestoredFilters] = useState<{
    tag?: string; category?: string; order?: string
  } | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setRestoredFilters(JSON.parse(raw))
    } catch {
      // ignore storage errors
    }
  }, [])

  const tagInQuery = 'tag' in router.query
  const categoryInQuery = 'category' in router.query
  const orderInQuery = 'order' in router.query

  const effectiveTag = tagInQuery ? currentTag : restoredFilters?.tag
  const effectiveCategory = categoryInQuery
    ? (router.query.category as string)
    : restoredFilters?.category || DEFAULT_CATEGORY
  const effectiveOrder = orderInQuery ? currentOrder : restoredFilters?.order || 'desc'

  useEffect(() => {
    setFilteredPosts(() => {
      let newFilteredPosts = data
      // keyword
      newFilteredPosts = newFilteredPosts.filter((post) => {
        const tagContent = post.tags ? post.tags.join(" ") : ""
        const searchContent = post.title + post.summary + tagContent
        return searchContent.toLowerCase().includes(q.toLowerCase())
      })

      // tag
      if (effectiveTag) {
        newFilteredPosts = newFilteredPosts.filter(
          (post) => post && post.tags && post.tags.includes(effectiveTag as string)
        )
      }

      // category
      if (effectiveCategory !== DEFAULT_CATEGORY) {
        newFilteredPosts = newFilteredPosts.filter(
          (post) => post && post.category && post.category.includes(effectiveCategory)
        )
      }
      // order
      if (effectiveOrder !== "desc") {
        newFilteredPosts = newFilteredPosts.reverse()
      }

      return newFilteredPosts
    })
  }, [data, q, effectiveTag, effectiveCategory, effectiveOrder])

  // Persist the filter choices whenever they change so they survive navigation.
  useEffect(() => {
    try {
      const payload = JSON.stringify({ tag: effectiveTag, category: effectiveCategory, order: effectiveOrder })
      sessionStorage.setItem(STORAGE_KEY, payload)
    } catch (e) {
      // ignore storage errors
    }
  }, [effectiveTag, effectiveCategory, effectiveOrder])

  return (
    <>
      <div className="my-2">
        {!filteredPosts.length && (
          <p className="text-gray-500 dark:text-gray-300">Nothing! 😺</p>
        )}
        {filteredPosts.map((post) => (
          <PostCard key={post.id} data={post} />
        ))}
      </div>
    </>
  )
}

export default PostList

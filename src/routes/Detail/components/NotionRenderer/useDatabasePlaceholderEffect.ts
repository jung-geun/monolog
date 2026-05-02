import { useEffect } from 'react'

/**
 * This hook injects database placeholder components into the correct positions
 * in the rendered Notion content by finding hidden collection_view_page elements
 * and inserting our custom placeholders right after them.
 */
export function useDatabasePlaceholderEffect() {
  useEffect(() => {
    // Wait for DOM to be fully rendered
    const timer = setTimeout(() => {
      // Find all placeholder wrappers we created
      const placeholderWrappers = document.querySelectorAll('.database-placeholder-wrapper')
      
      if (placeholderWrappers.length === 0) return
      
      // Find all notion blocks
      const allBlocks = document.querySelectorAll('.notion-block')
      
      placeholderWrappers.forEach((wrapper) => {
        const databaseId = wrapper.getAttribute('data-database-id')
        if (!databaseId) return
        
        // Try to find the block - react-notion-x adds block ID as part of class name
        // Format: notion-block-{blockId}
        const blockClass = `notion-block-${databaseId.replace(/-/g, '')}`
        let targetBlock = document.querySelector(`.${blockClass}`)
        
        if (!targetBlock) {
          // Try with dashes
          const blockClassWithDashes = `notion-block-${databaseId}`
          targetBlock = document.querySelector(`.${blockClassWithDashes}`)
        }
        
        if (!targetBlock) {
          return
        }
        
        // Insert the placeholder right after the target block
        if (targetBlock.parentNode) {
          targetBlock.parentNode.insertBefore(wrapper, targetBlock.nextSibling)
        }
      })
    }, 200) // Slightly longer delay to ensure react-notion-x has rendered
    
    // Cleanup function
    return () => {
      clearTimeout(timer)
    }
  }, [])
}

import { useEffect } from 'react'
import { ExtendedRecordMap } from 'notion-types'

export const useListItemColorEffect = (recordMap: ExtendedRecordMap | null) => {
  useEffect(() => {
    if (!recordMap) return

    const getBlock = (id: string) => {
        let block = recordMap.block[id]?.value
        if (!block && id.length === 32) {
            const uuid = `${id.substr(0, 8)}-${id.substr(8, 4)}-${id.substr(12, 4)}-${id.substr(16, 4)}-${id.substr(20)}`
            block = recordMap.block[uuid]?.value
        }
        if (!block && id.length === 36) {
            const rawId = id.replace(/-/g, '')
            block = recordMap.block[rawId]?.value
        }
        return block
    }

    const processList = (ul: Element, blockIds: string[]) => {
      if (!ul || !blockIds || blockIds.length === 0) return;

      const children = Array.from(ul.children);
      let currentBlockIndex = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tagName = child.tagName.toLowerCase();

        if (tagName === 'li') {
          if (currentBlockIndex >= blockIds.length) break;

          const blockId = blockIds[currentBlockIndex];
          const block = getBlock(blockId);

          if (block) {
            // Apply color to the li element
            const color = block.format?.block_color;
            if (color && color !== 'default') {
              const className = `notion-${color}`;
              if (!child.classList.contains(className)) {
                child.classList.add(className);
              }
            }

            // Handle nested lists
            // Check if the next sibling is a UL (nested list)
            const nextSibling = children[i + 1];
            if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
                if (block.content) {
                    processList(nextSibling, block.content);
                }
                i++; // Skip the ul in the main loop as we processed it
            } else {
                // Check if there is a UL inside the LI
                const internalUl = child.querySelector(':scope > ul');
                if (internalUl && block.content) {
                    processList(internalUl, block.content);
                }
            }
          }
          currentBlockIndex++;
        } else if (tagName === 'ul') {
            // If we encounter a UL that wasn't handled as a sibling of the previous LI,
            // it might be a loose list or structure we didn't anticipate.
            // However, in standard notion-x rendering, ULs usually follow LIs or are inside them.
            // If we are here, it might mean the list structure is slightly different or we missed a mapping.
            // We can't easily map without an LI context, so we might skip or try to infer.
        }
      }
    };

    const applyColors = () => {
      // 1. General block color application (for non-list blocks or wrappers)
      const blockElements = document.querySelectorAll('[class*="notion-block-"]')
      blockElements.forEach((el) => {
        const classes = Array.from(el.classList)
        const blockIdClass = classes.find(c => c.startsWith('notion-block-') && c.length > 13)
        if (!blockIdClass) return
        const idRaw = blockIdClass.replace('notion-block-', '')
        const block = getBlock(idRaw)
        
        if (block) {
            const color = block.format?.block_color
            if (color && color !== 'default') {
                const className = `notion-${color}`
                if (!el.classList.contains(className)) {
                    el.classList.add(className)
                }
            }
        }
      })

      // 2. Recursive list item color application
      // Find top-level lists (ul.notion-list that are not inside other notion-lists or li)
      // Actually, we can find all ULs that have a notion-block-{id} class, 
      // identify the start block, and traverse.
      
      const uls = document.querySelectorAll('ul.notion-list[class*="notion-block-"]');
      uls.forEach(ul => {
          // Check if this UL is a top-level list in the context of a block group
          // (i.e. it corresponds to a sequence of blocks starting with the one in its class ID)
          
          // Extract ID
          const classes = Array.from(ul.classList);
          const blockIdClass = classes.find(c => c.startsWith('notion-block-') && c.length > 13);
          if (!blockIdClass) return;
          const idRaw = blockIdClass.replace('notion-block-', '');
          const firstBlock = getBlock(idRaw);

          if (!firstBlock || !firstBlock.parent_id) return;

          const parentBlock = getBlock(firstBlock.parent_id);
          if (!parentBlock || !parentBlock.content) return;

          // Find the index of the first block in the parent's content
          const startIndex = parentBlock.content.indexOf(firstBlock.id);
          if (startIndex === -1) return;

          // The UL represents a sequence of blocks starting from startIndex.
          // But we need to be careful: does this UL represent *all* subsequent blocks?
          // Or just the ones that are list items?
          // react-notion-x groups consecutive list items into a UL.
          
          // We pass the slice of content starting from the first block.
          // The processList function will consume as many as there are LIs.
          // However, we should only do this for "root" ULs of a group to avoid double processing
          // if we iterate all ULs.
          // A "root" UL in this context is one where we can map its ID to a block in recordMap.
          // Nested ULs often share the ID of the parent LI (as per user feedback),
          // so getBlock(idRaw) would return the parent LI block, not the first child.
          
          // If getBlock(idRaw) returns a block that is a list item (bulleted_list, etc.),
          // then this UL is likely the container for that block and its siblings.
          // If the UL is nested, and shares ID with parent, we might process it via recursion from parent.
          
          // To avoid double processing, we can check if the UL is inside another UL/LI 
          // AND if we are already handling it via recursion.
          // But simple iteration might be safe if we re-apply classes idempotently.
          // The issue is mapping: if nested UL has parent ID, we can't find its start block from its class.
          // So we MUST rely on recursion for nested lists.
          
          // So, we should only initiate processList for ULs where the ID in class
          // matches the first LI child's block ID.
          // If the UL's class ID matches the first LI's logical block ID, we proceed.
          
          // Heuristic: If the UL is not inside another list structure (or is top level), process it.
          const parentLi = ul.closest('li.notion-list-item');
          const parentUl = ul.parentElement?.closest('ul.notion-list');
          
          if (!parentLi && !parentUl) {
              // This is a top-level list.
              // We need to find the sequence of block IDs.
              // We assume the UL's class ID is the ID of the first block in the list.
               const blockIds = parentBlock.content.slice(startIndex);
               processList(ul, blockIds);
          }
      });
    }

    // Run after a short delay to ensure DOM is rendered
    const timer = setTimeout(applyColors, 200)
    
    return () => clearTimeout(timer)
  }, [recordMap])
}

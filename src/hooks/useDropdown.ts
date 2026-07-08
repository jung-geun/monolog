import React, { useEffect, useRef, useState } from 'react'

type useDropdownType = () => [
  React.RefObject<HTMLDivElement | null>,
  boolean,
  () => void
]

function assertIsNode(e: EventTarget | null): asserts e is Node {
  if (!e || !("nodeType" in e)) {
    throw new Error(`Node expected`)
  }
}

const useDropdown: useDropdownType = () => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isDropdownOpened, setIsDropdownOpened] = useState(false)

  const handleOutsideClick = (e: MouseEvent) => {
    if (!menuRef.current) return
    assertIsNode(e.target)
    if (!menuRef.current.contains(e.target)) {
      setIsDropdownOpened(false)
    }
  }

  useEffect(() => {
    if (!isDropdownOpened) return

    window.addEventListener('click', handleOutsideClick)
    return () => {
      window.removeEventListener('click', handleOutsideClick)
    }
  }, [isDropdownOpened])

  const onOpenBtn = () => {
    setIsDropdownOpened(true)
  }

  return [menuRef, isDropdownOpened, onOpenBtn]
}

export default useDropdown

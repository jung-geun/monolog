import React from 'react'
import styled from '@emotion/styled'

interface DatabasePlaceholderProps {
  databaseId?: string
  title?: string
}

/**
 * Placeholder component for Notion database blocks
 * Shows a card with database icon and link to Notion
 * 
 * TODO (Option 3): Replace with custom database rendering
 * - Fetch database entries using Notion API
 * - Display as table/gallery/list view
 * - Support filtering and sorting
 */
export default function DatabasePlaceholder({ databaseId, title }: DatabasePlaceholderProps) {
  const notionUrl = databaseId ? `https://www.notion.so/${databaseId.replace(/-/g, '')}` : '#'
  
  return (
    <Container data-placeholder-content="true">
      <Icon>
        📊
      </Icon>
      <Content>
        <Title>{title || '데이터베이스'}</Title>
        <Description>
          이 데이터베이스는 Notion에서 확인할 수 있습니다
        </Description>
        <ViewButton 
          href={notionUrl} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          Notion에서 보기 →
        </ViewButton>
      </Content>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  margin: 1rem 0;
  border-radius: 0.75rem;
  border: 2px dashed currentColor;
  opacity: 0.8;
  transition: all 0.2s ease;

  &:hover {
    opacity: 1;
    border-style: solid;
  }
`

const Icon = styled.div`
  font-size: 2rem;
  line-height: 1;
`

const Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const Title = styled.div`
  font-size: 1.125rem;
  font-weight: 600;
`

const Description = styled.div`
  font-size: 0.875rem;
  opacity: 0.7;
`

const ViewButton = styled.a`
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  width: fit-content;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
    transform: translateX(2px);
  }
`

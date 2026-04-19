import React from 'react'
import { Box, Text, useInput } from 'ink'

export function BorderBox({ title, children, width, height, focused }: {
  title?: string
  children: React.ReactNode
  width?: number | string
  height?: number | string
  focused?: boolean
}) {
  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box>
        <Text color={focused ? 'cyan' : 'gray'}>┌{'─'.repeat(typeof width === 'number' ? width - 2 : 28)}</Text>
        {title && <Text color={focused ? 'cyan' : 'gray'}>{title}</Text>}
        <Text color={focused ? 'cyan' : 'gray'}>{'─'.repeat(5)}┐</Text>
      </Box>
      <Box flexGrow={1} paddingX={1}>
        {children}
      </Box>
      <Box>
        <Text color={focused ? 'cyan' : 'gray'}>└{'─'.repeat(typeof width === 'number' ? width - 2 : 28)}{'─'.repeat(5)}┘</Text>
      </Box>
    </Box>
  )
}

export function Sidebar({ items, selected, width = 20 }: {
  items: string[]
  selected: number
  width?: number
}) {
  return (
    <Box flexDirection="column" width={width}>
      {items.map((item, i) => (
        <Box key={item} paddingX={1}>
          <Text color={i === selected ? 'cyan' : 'white'} bold={i === selected}>
            {i === selected ? '› ' : '  '}{item}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export function StatusBar({ hints }: { hints: string }) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray" dimColor>{hints}</Text>
    </Box>
  )
}

export function FieldRow({ label, value, editing, cursor }: {
  label: string
  value: string
  editing?: boolean
  cursor?: number
}) {
  return (
    <Box>
      <Box width={16}><Text bold color="gray">{label}:</Text></Box>
      {editing ? (
        <Text color="yellow">{value}<Text backgroundColor="cyan"> </Text></Text>
      ) : (
        <Text>{value}</Text>
      )}
    </Box>
  )
}

export function ToggleRow({ label, value, selected }: {
  label: string
  value: boolean
  selected?: boolean
}) {
  return (
    <Box>
      <Box width={16}><Text bold color="gray">{label}:</Text></Box>
      <Text color={value ? 'green' : 'red'}>{value ? '● ON' : '○ OFF'}</Text>
      {selected && <Text color="cyan"> ←</Text>}
    </Box>
  )
}

export function SuccessMsg({ text }: { text: string }) {
  return <Text color="green">  ✓ {text}</Text>
}

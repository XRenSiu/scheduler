type Heap = Array<Node>
type Node = {
  id: number
  sortIndex: number
}

export function push(heap: Heap, node: Node): number {
  const index = heap.length
  heap.push(node)
  swim(heap, node, index)
  return index + 1
}

export function top(heap: Heap): Node | null {
  const first = heap[0]
  return first === undefined ? null : first
}

export function pop(heap: Heap): Node | null {
  const first = heap[0]
  if (first !== undefined) {
    const last = heap.pop()
    if (last !== first) {
      heap[0] = last
      sink(heap, 0, heap.length)
    }
    return first
  } else {
    return null
  }
}

function swim(heap: Heap, node: Node, i: number) {
  let index = i
  while (true) {
    const parentIndex = (index - 1) >>> 1
    const parent = heap[parentIndex]
    if (parent !== undefined && compare(parent, node) > 0) {
      // The parent is larger. Swap positions.
      swap(heap, parentIndex, index)
      index = parentIndex
    } else {
      // The parent is smaller. Exit.
      return
    }
  }
}

function sink(heap: Heap, index: number, lengthTag: number) {
  let node = heap[index]
  const length = lengthTag
  debugger
  while (index < length) {
    const leftIndex = (index + 1) * 2 - 1
    const left = leftIndex >= length ? undefined : heap[leftIndex]
    const rightIndex = leftIndex + 1
    const right = rightIndex >= length ? undefined : heap[rightIndex]

    // If the left or right node is smaller, swap with the smaller of those.
    if (left !== undefined && compare(left, node) < 0) {
      if (right !== undefined && compare(right, left) < 0) {
        heap[index] = right
        heap[rightIndex] = node
        index = rightIndex
      } else {
        heap[index] = left
        heap[leftIndex] = node
        index = leftIndex
      }
    } else if (right !== undefined && compare(right, node) < 0) {
      heap[index] = right
      heap[rightIndex] = node
      index = rightIndex
    } else {
      // Neither child is smaller. Exit.
      return
    }
  }
}

function swap<T>(a: Array<T>, i: number, j: number) {
  let temp = a[i]
  a[i] = a[j]
  a[j] = temp
}

function compare(a: Node, b: Node) {
  // Compare sort index first, then task id.
  const diff = a.sortIndex - b.sortIndex
  return diff !== 0 ? diff : a.id - b.id
}

export function buildMinHeap(arr: Array<Node>) {
  let length = arr.length
  for (let k = Math.floor(length / 2) - 1; k >= 0; k--) {
    sink(arr, k, length)
  }
  return arr
}

export function minHeapSort(arr: Array<Node>) {
  let minHeap = buildMinHeap(arr)
  let length = minHeap.length
  while (length > 0) {
    swap(minHeap, 0, --length)
    sink(minHeap, 0, length)
  }
  return minHeap
}

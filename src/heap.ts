type Node = {
  id: number
  sortIndex: number
}
abstract class Heap {
  store: Array<Node> = []

  public push(node: Node) {
    const index = this.store.length
    this.store.push(node)
    this.swim(node, index)
    return index + 1
  }

  public top(): Node | null {
    const first = this.store[0]
    return first === undefined ? null : first
  }

  public pop(): Node | null {
    const heap = this.store
    const first = heap[0]
    if (first !== undefined) {
      const last = heap.pop()
      if (last !== first) {
        heap[0] = last
        this.sink(0, heap.length)
      }
      return first
    } else {
      return null
    }
  }

  public build(arr: Array<Node>) {
    this.store = arr
    let length = arr.length
    for (let k = Math.floor(length / 2) - 1; k >= 0; k--) {
      this.sink(k, length)
    }
    return this
  }

  sink(index: number, lengthTag: number) {
    const heap = this.store
    let node = heap[index]
    const length = lengthTag
    debugger
    while (index < length) {
      const leftIndex = (index + 1) * 2 - 1
      const left = leftIndex >= length ? undefined : heap[leftIndex]
      const rightIndex = leftIndex + 1
      const right = rightIndex >= length ? undefined : heap[rightIndex]

      // If the left or right node is smaller, swap with the smaller of those.
      if (left !== undefined && this.compare(left, node) < 0) {
        if (right !== undefined && this.compare(right, left) < 0) {
          heap[index] = right
          heap[rightIndex] = node
          index = rightIndex
        } else {
          heap[index] = left
          heap[leftIndex] = node
          index = leftIndex
        }
      } else if (right !== undefined && this.compare(right, node) < 0) {
        heap[index] = right
        heap[rightIndex] = node
        index = rightIndex
      } else {
        // Neither child is smaller. Exit.
        return
      }
    }
  }

  swim(node: Node, i: number) {
    let index = i
    while (true) {
      const parentIndex = (index - 1) >>> 1
      const parent = this.store[parentIndex]
      if (parent !== undefined && this.compare(parent, node) > 0) {
        // The parent is larger. Swap positions.
        this.swap(parentIndex, index)
        index = parentIndex
      } else {
        // The parent is smaller. Exit.
        return
      }
    }
  }

  swap(i: number, j: number) {
    const heap = this.store
    let temp = heap[i]
    heap[i] = heap[j]
    heap[j] = temp
  }

  abstract compare(a: Node, b: Node): number
}

export class MinHeap extends Heap {
  compare(a: Node, b: Node) {
    // Compare sort index first, then task id.
    const diff = a.sortIndex - b.sortIndex
    return diff !== 0 ? diff : a.id - b.id
  }
}

export class MaxHeap extends Heap {
  compare(a: Node, b: Node) {
    // Compare sort index first, then task id.
    const diff = b.sortIndex - a.sortIndex
    return diff !== 0 ? diff : b.id - a.id
  }
}

export function buildMinHeap(arr: Array<Node>) {
  const minHeap = new MinHeap()
  return minHeap.build(arr)
}

export function buildMaxHeap(arr: Array<Node>) {
  const maxHeap = new MaxHeap()
  return maxHeap.build(arr)
}

export function heapSortBigger(arr: Array<Node>): Array<Node> {
  let maxHeap = buildMaxHeap(arr)
  let length = maxHeap.store.length
  while (length > 0) {
    maxHeap.swap(0, --length)
    maxHeap.sink(0, length)
  }
  return maxHeap.store
}

export function heapSortLess(arr: Array<Node>): Array<Node> {
  let minHeap = buildMinHeap(arr)
  let length = minHeap.store.length
  while (length > 0) {
    minHeap.swap(0, --length)
    minHeap.sink(0, length)
  }
  return minHeap.store
}

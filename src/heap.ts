type Node = {
  id: number
  sortIndex: number
}
abstract class Heap<T> {
  store: Array<T>

  constructor(arr: Array<T> = []) {
    this.store = arr
    let length = arr.length
    for (let k = Math.floor(length / 2) - 1; k >= 0; k--) {
      this.sink(k, length)
    }
  }

  public push(node: T) {
    const index = this.store.length
    this.store.push(node)
    this.swim(node, index)
    return index + 1
  }

  public top(): T | null {
    const first = this.store[0]
    return first === undefined ? null : first
  }

  public pop(): T | null {
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

  swim(node: T, i: number) {
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

  abstract compare(a: T, b: T): number
}

export class MinHeap extends Heap<Node> {
  compare(a: Node, b: Node) {
    // Compare sort index first, then task id.
    const diff = a.sortIndex - b.sortIndex
    return diff !== 0 ? diff : a.id - b.id
  }
}

export class MaxHeap extends Heap<Node> {
  compare(a: Node, b: Node) {
    // Compare sort index first, then task id.
    const diff = b.sortIndex - a.sortIndex
    return diff !== 0 ? diff : b.id - a.id
  }
}

export function heapSort(arr: Array<Node>, increase = true) {
  let heap = increase ? new MaxHeap(arr) : new MinHeap(arr)
  let length = heap.store.length
  while (length > 0) {
    heap.swap(0, --length)
    heap.sink(0, length)
  }
  return heap.store
}

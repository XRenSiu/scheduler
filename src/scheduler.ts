import {
  getCurrentTime,
  requestHostCallback,
  requestHostTimeout,
  cancelHostTimeout,
  shouldYieldToHost
} from './scheduler-host-config'
import { MinHeap } from './heap'
import {
  NoPriority,
  ImmediatePriority,
  UserBlockingPriority,
  IdlePriority,
  LowPriority,
  NormalPriority,
  IMMEDIATE_PRIORITY_TIMEOUT,
  USER_BLOCKING_PRIORITY_TIMEOUT,
  IDLE_PRIORITY_TIMEOUT,
  LOW_PRIORITY_TIMEOUT,
  NORMAL_PRIORITY_TIMEOUT
} from './scheduler-priorities'

const taskQueue = new MinHeap()
const timerQueue = new MinHeap()

type Task = {
  id: number
  callback: Function
  priorityLevel: number
  startTime: number
  expirationTime: number
  sortIndex: number
}

// Incrementing id counter. Used to maintain insertion order.
let taskIdCounter = 1

let currentTask: Task = null
let currentPriorityLevel = NormalPriority

// This is set while performing work, to prevent re-entrancy.
let isPerformingWork = false

let isHostCallbackScheduled = false
let isHostTimeoutScheduled = false

export function scheduleCallback(
  priorityLevel: number,
  callback: Function,
  options = {} as {
    delay: number
    timeout: number
  }
) {
  let currentTime = getCurrentTime()

  let startTime
  let timeout
  if (typeof options === 'object' && options !== null) {
    let delay = options.delay
    if (typeof delay === 'number' && delay > 0) {
      startTime = currentTime + delay
    } else {
      startTime = currentTime
    }
    timeout =
      typeof options.timeout === 'number'
        ? options.timeout
        : timeoutForPriorityLevel(priorityLevel)
  } else {
    timeout = timeoutForPriorityLevel(priorityLevel)
    startTime = currentTime
  }

  const expirationTime = startTime + timeout

  const newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1
  }

  if (startTime > currentTime) {
    // This is a delayed task.
    newTask.sortIndex = startTime
    timerQueue.push(newTask)
    if (taskQueue.top() === null && newTask === timerQueue.top()) {
      // All tasks are delayed, and this is the task with the earliest delay.
      if (isHostTimeoutScheduled) {
        // Cancel an existing timeout.
        cancelHostTimeout()
      } else {
        isHostTimeoutScheduled = true
      }
      // Schedule a timeout.
      requestHostTimeout(handleTimeout, startTime - currentTime)
    }
  } else {
    newTask.sortIndex = expirationTime
    taskQueue.push(newTask)
    // Schedule a host callback, if needed. If we're already performing work,
    // wait until the next time we yield.
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true
      requestHostCallback(flushWork)
    }
  }

  return newTask
}

export function cancelCallback(task: Task) {
  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null
}

function advanceTimers(currentTime: number) {
  // Check for tasks that are no longer delayed and add them to the queue.
  let timer = timerQueue.top() as Task
  while (timer !== null) {
    if (timer.callback === null) {
      // Timer was cancelled.
      timerQueue.pop()
    } else if (timer.startTime <= currentTime) {
      // Timer fired. Transfer to the task queue.
      timerQueue.pop()
      timer.sortIndex = timer.expirationTime
      taskQueue.push(timer)
    } else {
      // Remaining timers are pending.
      return
    }
    timer = timerQueue.top() as Task
  }
}

function timeoutForPriorityLevel(priorityLevel: number) {
  switch (priorityLevel) {
    case ImmediatePriority:
      return IMMEDIATE_PRIORITY_TIMEOUT
    case UserBlockingPriority:
      return USER_BLOCKING_PRIORITY_TIMEOUT
    case IdlePriority:
      return IDLE_PRIORITY_TIMEOUT
    case LowPriority:
      return LOW_PRIORITY_TIMEOUT
    case NormalPriority:
    default:
      return NORMAL_PRIORITY_TIMEOUT
  }
}

function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false
  advanceTimers(currentTime)

  if (!isHostCallbackScheduled) {
    if (taskQueue.top() !== null) {
      isHostCallbackScheduled = true
      requestHostCallback(flushWork)
    } else {
      const firstTimer = timerQueue.top() as Task
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
      }
    }
  }
}

function flushWork(hasTimeRemaining: Function, initialTime: number) {
  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false
  if (isHostTimeoutScheduled) {
    // We scheduled a timeout but it's no longer needed. Cancel it.
    isHostTimeoutScheduled = false
    cancelHostTimeout()
  }

  isPerformingWork = true
  const previousPriorityLevel = currentPriorityLevel
  try {
    return workLoop(hasTimeRemaining, initialTime)
  } finally {
    currentTask = null
    currentPriorityLevel = previousPriorityLevel
    isPerformingWork = false
  }
}

function workLoop(hasTimeRemaining: Function, initialTime: number) {
  let currentTime = initialTime
  advanceTimers(currentTime)
  currentTask = taskQueue.top() as Task
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && !hasTimeRemaining()) {
      // This currentTask hasn't expired, and we've reached the deadline.
      break
    }
    const callback = currentTask.callback
    if (callback !== null) {
      currentTask.callback = null
      currentPriorityLevel = currentTask.priorityLevel
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime
      const continuationCallback = callback(didUserCallbackTimeout)
      currentTime = getCurrentTime()
      if (typeof continuationCallback === 'function') {
        currentTask.callback = continuationCallback
      } else {
        if (currentTask === taskQueue.top()) {
          taskQueue.pop()
        }
      }
      advanceTimers(currentTime)
    } else {
      taskQueue.pop()
    }
    currentTask = taskQueue.top() as Task
  }
  // Return whether there's additional work
  if (currentTask !== null) {
    return true
  } else {
    const firstTimer = timerQueue.top() as Task
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
    }
    return false
  }
}

export function shouldYield() {
  const currentTime = getCurrentTime()
  advanceTimers(currentTime)
  const firstTask = taskQueue.top() as Task
  return (
    (firstTask !== currentTask &&
      currentTask !== null &&
      firstTask !== null &&
      firstTask.callback !== null &&
      firstTask.startTime <= currentTime &&
      firstTask.expirationTime < currentTask.expirationTime) ||
    shouldYieldToHost()
  )
}

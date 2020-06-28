let yieldInterval = 5
export let forceFrameRate = function (fps: number) {
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
        'forcing frame rates higher than 125 fps is not unsupported'
    )
    return
  }
  if (fps > 0) {
    yieldInterval = Math.floor(1000 / fps)
  } else {
    // reset the framerate
    yieldInterval = 5
  }
}

// The scheduledHostCallback task just can execute before the dealine.
let deadline = 0
export let getCurrentTime = function () {
  return window.performance.now()
}
export let shouldYieldToHost = function () {
  return getCurrentTime() >= deadline
}

const channel = new MessageChannel()
const port = channel.port2
channel.port1.onmessage = performWorkUntilDeadline

type ScheduledHostCallback = (
  hasTimeRemaining: () => boolean,
  currentTime: number
) => boolean
let scheduledHostCallback: ScheduledHostCallback

let isMessageLoopRunning = false
function performWorkUntilDeadline() {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime()
    // Yield after `yieldInterval` ms, regardless of where we are in the vsync
    // cycle. This means there's always time remaining at the beginning of
    // the message event.
    deadline = currentTime + yieldInterval
    const hasTimeRemaining = () => !shouldYieldToHost()
    try {
      const hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime)
      if (!hasMoreWork) {
        isMessageLoopRunning = false
        scheduledHostCallback = null
      } else {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        port.postMessage(null)
      }
    } catch (error) {
      // If a scheduler task throws, exit the current browser task so the
      // error can be observed.
      port.postMessage(null)
      throw error
    }
  } else {
    isMessageLoopRunning = false
  }
}

export let requestHostCallback = function (callback: ScheduledHostCallback) {
  scheduledHostCallback = callback
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true
    port.postMessage(null)
  }
}

export let cancelHostCallback = function () {
  scheduledHostCallback = null
}

let taskTimeoutID = -1
export let requestHostTimeout = function (callback: Function, ms: number) {
  taskTimeoutID = window.setTimeout(() => {
    callback(getCurrentTime())
  }, ms)
}
export let cancelHostTimeout = function () {
  window.clearTimeout(taskTimeoutID)
  taskTimeoutID = -1
}

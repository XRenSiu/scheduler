import {
  NoPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
  ImmediatePriority,
  UserBlockingPriority
} from '../scheduler-priorities'

type Runtime = {
  advanceTime: Function
  fireMessageEvent: Function
  log: Function
  isLogEmpty: Function
  assertLog: Function
}

describe('scheduler', () => {
  let runtime: Runtime
  let scheduleCallback: Function
  let cancelCallback: Function
  let shouldYield: Function
  let performance: any

  beforeEach(() => {
    jest.resetModules()

    runtime = installMockBrowserRuntime()
    performance = window.performance
    const Scheduler = require('../scheduler')
    cancelCallback = Scheduler.cancelCallback
    scheduleCallback = Scheduler.scheduleCallback
    shouldYield = Scheduler.shouldYield
  })

  afterEach(() => {
    if (!runtime.isLogEmpty()) {
      throw Error('Test exited without clearing log.')
    }
  })

  function installMockBrowserRuntime() {
    let hasPendingMessageEvent = false

    let timerIDCounter = 0
    // let timerIDs = new Map();

    let eventLog: string[] = []

    const window: any = {}
    global.window = window

    let currentTime = 0

    window.performance = {
      now() {
        return currentTime
      }
    }

    // TODO: Scheduler no longer requires these methods to be polyfilled. But
    // maybe we want to continue warning if they don't exist, to preserve the
    // option to rely on it in the future?
    window.requestAnimationFrame = window.cancelAnimationFrame = () => {}

    window.setTimeout = (cb: Function, delay: number) => {
      const id = timerIDCounter++
      log(`Set Timer`)
      // TODO
      return id
    }
    window.clearTimeout = (id: number) => {
      // TODO
    }

    const port1 = { onmessage: () => {} }
    const port2 = {
      postMessage() {
        if (hasPendingMessageEvent) {
          throw Error('Message event already scheduled')
        }
        log('Post Message')
        hasPendingMessageEvent = true
      }
    }

    ;(global as any).MessageChannel = function MessageChannel() {
      this.port1 = port1
      this.port2 = port2
    }

    function ensureLogIsEmpty() {
      if (eventLog.length !== 0) {
        throw Error('Log is not empty. Call assertLog before continuing.')
      }
    }
    function advanceTime(ms: number) {
      currentTime += ms
    }
    function fireMessageEvent() {
      ensureLogIsEmpty()
      if (!hasPendingMessageEvent) {
        throw Error('No message event was scheduled')
      }
      hasPendingMessageEvent = false
      const onMessage = port1.onmessage
      log('Message Event')
      onMessage()
    }
    function log(val: string) {
      eventLog.push(val)
    }
    function isLogEmpty() {
      return eventLog.length === 0
    }
    function assertLog(expected: string[]) {
      const actual = eventLog
      eventLog = []
      expect(actual).toEqual(expected)
    }
    return {
      advanceTime,
      fireMessageEvent,
      log,
      isLogEmpty,
      assertLog
    }
  }

  it('task that finishes before deadline', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('Task')
    })
    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'Task'])
  })

  it('task with continuation', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('Task')
      while (!shouldYield()) {
        runtime.advanceTime(1)
      }
      runtime.log(`Yield at ${performance.now()}ms`)
      return () => {
        runtime.log('Continuation')
      }
    })
    runtime.assertLog(['Post Message'])

    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'Task', 'Yield at 5ms', 'Post Message'])

    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'Continuation'])
  })

  it('multiple tasks', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('A')
    })
    scheduleCallback(NormalPriority, () => {
      runtime.log('B')
    })
    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'A', 'B'])
  })

  it('multiple tasks with a yield in between', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('A')
      runtime.advanceTime(4999)
    })
    scheduleCallback(NormalPriority, () => {
      runtime.log('B')
    })
    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog([
      'Message Event',
      'A',
      // Ran out of time. Post a continuation event.
      'Post Message'
    ])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'B'])
  })

  it('cancels tasks', () => {
    const task = scheduleCallback(NormalPriority, () => {
      runtime.log('Task')
    })
    runtime.assertLog(['Post Message'])
    cancelCallback(task)
    runtime.assertLog([])
  })

  it('throws when a task errors then continues in a new event', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('Oops!')
      throw Error('Oops!')
    })
    scheduleCallback(NormalPriority, () => {
      runtime.log('Yay')
    })
    runtime.assertLog(['Post Message'])

    expect(() => runtime.fireMessageEvent()).toThrow('Oops!')
    runtime.assertLog(['Message Event', 'Oops!', 'Post Message'])

    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'Yay'])
  })

  it('schedule new task after queue has emptied', () => {
    scheduleCallback(NormalPriority, () => {
      runtime.log('A')
    })

    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'A'])

    scheduleCallback(NormalPriority, () => {
      runtime.log('B')
    })
    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'B'])
  })

  it('schedule new task after a cancellation', () => {
    const handle = scheduleCallback(NormalPriority, () => {
      runtime.log('A')
    })

    runtime.assertLog(['Post Message'])
    cancelCallback(handle)

    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event'])

    scheduleCallback(NormalPriority, () => {
      runtime.log('B')
    })
    runtime.assertLog(['Post Message'])
    runtime.fireMessageEvent()
    runtime.assertLog(['Message Event', 'B'])
  })
})

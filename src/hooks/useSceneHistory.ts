import { useReducer } from 'react'
import type { Scene } from '../types'
import { scenesEqual } from '../utils/layout'

interface HistoryState {
  past: Scene[]
  present: Scene
  future: Scene[]
  transactionStart: Scene | null
}

type Action =
  | { type: 'commit'; scene: Scene }
  | { type: 'commit-latest'; update: (scene: Scene) => Scene }
  | { type: 'live'; scene: Scene }
  | { type: 'begin' }
  | { type: 'end' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; scene: Scene }
  | { type: 'reset'; scene: Scene }

const LIMIT = 80

const reducer = (state: HistoryState, action: Action): HistoryState => {
  switch (action.type) {
    case 'commit':
      if (scenesEqual(state.present, action.scene)) return state
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: action.scene,
        future: [],
        transactionStart: null,
      }
    case 'commit-latest': {
      const scene = action.update(state.present)
      if (scenesEqual(state.present, scene)) return state
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: scene,
        future: [],
        transactionStart: null,
      }
    }
    case 'live':
      return { ...state, present: action.scene }
    case 'begin':
      return state.transactionStart ? state : { ...state, transactionStart: state.present }
    case 'end':
      if (!state.transactionStart) return state
      if (scenesEqual(state.transactionStart, state.present)) return { ...state, transactionStart: null }
      return {
        past: [...state.past, state.transactionStart].slice(-LIMIT),
        present: state.present,
        future: [],
        transactionStart: null,
      }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, LIMIT),
        transactionStart: null,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: next,
        future: state.future.slice(1),
        transactionStart: null,
      }
    }
    case 'load':
      return { past: [state.present], present: action.scene, future: [], transactionStart: null }
    case 'reset':
      return { past: [], present: action.scene, future: [], transactionStart: null }
  }
}

export const useSceneHistory = (initialScene: Scene) => {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: initialScene,
    future: [],
    transactionStart: null,
  })

  return {
    scene: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit: (scene: Scene) => dispatch({ type: 'commit', scene }),
    commitLatest: (update: (scene: Scene) => Scene) => dispatch({ type: 'commit-latest', update }),
    updateLive: (scene: Scene) => dispatch({ type: 'live', scene }),
    beginTransaction: () => dispatch({ type: 'begin' }),
    endTransaction: () => dispatch({ type: 'end' }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    load: (scene: Scene) => dispatch({ type: 'load', scene }),
    reset: (scene: Scene) => dispatch({ type: 'reset', scene }),
  }
}

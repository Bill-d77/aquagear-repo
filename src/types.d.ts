declare module 'react-dom' {
    export function useFormState<State>(
        action: (state: State, payload: FormData) => Promise<State>,
        initialState: State,
        permalink?: string
    ): [State, (payload: FormData) => void];
}

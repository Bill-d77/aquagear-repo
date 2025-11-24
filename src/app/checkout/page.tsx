"use client";

import { useFormState } from "react-dom";
import { submitOrder } from "./actions";

const initialState = {
  message: "",
  errors: {},
};

export default function Checkout() {
  const [state, formAction] = useFormState(submitOrder, initialState);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Checkout</h1>

      <form action={formAction} className="space-y-6">
        {state?.message && (
          <div className={`p-4 rounded-lg ${state.errors ? "bg-red-50 text-red-700" : "bg-red-50 text-red-700"}`}>
            {state.message}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
            />
            {state?.errors?.name && <p className="text-red-600 text-sm mt-1">{state.errors.name}</p>}
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
            />
            {state?.errors?.phoneNumber && <p className="text-red-600 text-sm mt-1">{state.errors.phoneNumber}</p>}
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location (City, Area)</label>
            <input
              type="text"
              id="location"
              name="location"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
            />
            {state?.errors?.location && <p className="text-red-600 text-sm mt-1">{state.errors.location}</p>}
          </div>

          <div>
            <label htmlFor="apartment" className="block text-sm font-medium text-gray-700">Apartment / Building (Optional)</label>
            <input
              type="text"
              id="apartment"
              name="apartment"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2 border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
            <div className="mt-2">
              <div className="flex items-center">
                <input
                  id="cod"
                  name="paymentMode"
                  type="radio"
                  defaultChecked
                  value="COD"
                  className="h-4 w-4 border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="cod" className="ml-3 block text-sm font-medium text-gray-700">
                  Cash on Delivery
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          >
            Place Order
          </button>
        </div>
      </form>
    </div>
  );
}

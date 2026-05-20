export function unwrapFunctionResponse(response) {
  return response && Object.prototype.hasOwnProperty.call(response, "data")
    ? response.data
    : response;
}

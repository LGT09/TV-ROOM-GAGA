/** An API may be replaced by a host error page; never surface JSON parser internals. */
export async function readApiJson<T=any>(response:Response):Promise<T> {
  const text=await response.text()
  let body:any
  try { body=JSON.parse(text) }catch{
    throw new Error(response.status===504?"The media request timed out. Please retry.":"The server returned a page instead of media data. Please retry; if this continues, check the deployment's API routes.")
  }
  if(!response.ok)throw new Error(body.error||"The media request failed. Please retry.")
  return body
}

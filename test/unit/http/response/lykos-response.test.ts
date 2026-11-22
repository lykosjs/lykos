import { describe, expect, test } from 'bun:test'
import { StatusCode } from '../../../../src/http/response/status-code'
import { LykosReply } from '../../../../src/http/response/lykos-response'

// ---------------------------------------------------------------------------
// send / json / status / header
// ---------------------------------------------------------------------------

describe('send()', () => {
  test('string body defaults to 200 and text/plain', async () => {
    const res = LykosReply().send('hello')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toBe('hello')
  })

  test('uses the status set via status()', () => {
    const res = LykosReply().status(418).send('teapot')

    expect(res.status).toBe(418)
  })

  test('non-string body does not get a text/plain Content-Type', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const res = LykosReply().send(bytes as never)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).not.toBe('text/plain; charset=utf-8')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })

  test('null body produces an empty response', async () => {
    const res = LykosReply().send(null as never)

    expect(await res.text()).toBe('')
  })

  test('custom headers are kept and text/plain is added for strings', () => {
    const res = LykosReply().header('X-Custom', 'yes').send('hello')

    expect(res.headers.get('X-Custom')).toBe('yes')
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })

  test('does not override a developer-defined Content-Type', () => {
    const res = LykosReply().header('Content-Type', 'text/html').send('<p>hi</p>')

    expect(res.headers.get('Content-Type')).toBe('text/html')
  })

  test('custom headers with a non-string body do not add Content-Type text/plain', () => {
    const res = LykosReply()
      .header('X-Custom', 'yes')
      .send(new Uint8Array([1]) as never)

    expect(res.headers.get('X-Custom')).toBe('yes')
    expect(res.headers.get('Content-Type')).not.toBe('text/plain; charset=utf-8')
  })

  test('the shared default headers are not mutated between calls', () => {
    const first = LykosReply().send('a')
    first.headers.set('X-Leak', '1')
    const second = LykosReply().send('b')

    expect(second.headers.get('X-Leak')).toBeNull()
    expect(second.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })
})

describe('json()', () => {
  test('defaults to the current status (200)', async () => {
    const res = LykosReply().json({ a: 1 })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(await res.json()).toEqual({ a: 1 })
  })

  test('uses status() when no explicit status is passed', () => {
    const res = LykosReply().status(201).json({ ok: true })

    expect(res.status).toBe(201)
  })

  test('explicit status argument wins over status()', () => {
    const res = LykosReply().status(201).json({ ok: true }, 202)

    expect(res.status).toBe(202)
  })

  test('applies custom headers', () => {
    const res = LykosReply().header('X-Id', '42').json({ ok: true })

    expect(res.headers.get('X-Id')).toBe('42')
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })

  test('throws TypeError for null-body statuses (204, 205, 304)', () => {
    for (const status of [204, 205, 304]) {
      expect(() => LykosReply().json({ a: 1 }, status)).toThrow(TypeError)
    }
  })

  test('throws RangeError for invalid statuses', () => {
    for (const status of [100, 199, 600, 200.5, Number.NaN, -1]) {
      expect(() => LykosReply().json({ a: 1 }, status)).toThrow(RangeError)
    }
  })

  test('accepts the boundary statuses 200 and 599', () => {
    expect(LykosReply().json({}, 200).status).toBe(200)
    expect(LykosReply().json({}, 599).status).toBe(599)
  })
})

describe('status()', () => {
  test('is chainable and returns the same instance', () => {
    const reply = LykosReply()

    expect(reply.status(404)).toBe(reply)
  })

  test('the last call wins', () => {
    const res = LykosReply().status(400).status(500).send('x')

    expect(res.status).toBe(500)
  })
})

describe('header()', () => {
  test('is chainable and returns the same instance', () => {
    const reply = LykosReply()

    expect(reply.header('X-A', '1')).toBe(reply)
  })

  test('setting the same header twice overwrites it', () => {
    const res = LykosReply().header('X-A', '1').header('X-A', '2').send('x')

    expect(res.headers.get('X-A')).toBe('2')
  })

  test('headers are case-insensitive', () => {
    const res = LykosReply().header('x-custom', 'a').send('x')

    expect(res.headers.get('X-Custom')).toBe('a')
  })

  test('headers do not leak between instances', () => {
    LykosReply().header('X-Leak', '1')
    const res = LykosReply().send('x')

    expect(res.headers.get('X-Leak')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Detachable members and assignable accessors
// ---------------------------------------------------------------------------

describe('detached members', () => {
  test('destructured methods keep working', async () => {
    const { OK, json, status, send } = LykosReply()

    expect(OK().status).toBe(200)
    expect(json({ a: 1 }).status).toBe(200)
    expect(send('x').status).toBe(200)
    expect(typeof status).toBe('function')
  })

  test('a detached status() still mutates the right instance', () => {
    const reply = LykosReply()
    const { status } = reply

    status(404)

    expect(reply.send('x').status).toBe(404)
  })

  test('a detached header() still mutates the right instance', () => {
    const reply = LykosReply()
    const { header } = reply

    header('X-A', '1')

    expect(reply.send('x').headers.get('X-A')).toBe('1')
  })

  test('detached shortcuts keep the instance headers', () => {
    const reply = LykosReply().header('X-A', '1')
    const { NotFound } = reply

    expect(NotFound().headers.get('X-A')).toBe('1')
  })
})

describe('assignable members', () => {
  test('reply.json = mock replaces the member on that instance', () => {
    const reply = LykosReply()
    const mock = () => new Response('mocked')

    reply.json = mock

    expect(reply.json).toBe(mock)
  })

  test('assignment does not affect other instances', () => {
    const a = LykosReply()
    const b = LykosReply()

    a.json = () => new Response('mocked')

    expect(b.json({ ok: true }).status).toBe(200)
    expect(b.json).not.toBe(a.json)
  })

  test('the assigned property is an own, enumerable, writable property', () => {
    const reply = LykosReply()
    reply.json = () => new Response('first')
    const descriptor = Object.getOwnPropertyDescriptor(reply, 'json')

    expect(descriptor?.enumerable).toBe(true)
    expect(descriptor?.writable).toBe(true)
    expect(descriptor?.configurable).toBe(true)

    reply.json = () => new Response('second')
    expect(reply.json({}).status).toBe(200)
  })

  test('assigning a mock for a shortcut method works (OK)', async () => {
    const reply = LykosReply()
    reply.OK = () => new Response('custom-ok', { status: 200 })

    expect(await reply.OK().text()).toBe('custom-ok')
  })
})

// ---------------------------------------------------------------------------
// 1xx (informational): not constructible with the Fetch Response
// ---------------------------------------------------------------------------

describe('1xx informational', () => {
  const methods = ['Continue', 'SwitchingProtocols', 'Processing', 'EarlyHints'] as const

  for (const name of methods) {
    test(`${name}() throws RangeError (status < 200)`, () => {
      const reply = LykosReply()

      expect(() => reply[name]()).toThrow(RangeError)
    })
  }
})

// ---------------------------------------------------------------------------
// 2xx
// ---------------------------------------------------------------------------

describe('2xx success', () => {
  test('OK() has a default body', async () => {
    const res = LykosReply().OK()

    expect(res.status).toBe(StatusCode.OK)
    expect(await res.json()).toEqual({ message: 'OK' })
  })

  test('OK(data) uses the provided data', async () => {
    const res = LykosReply().OK({ users: [1, 2] })

    expect(await res.json()).toEqual({ users: [1, 2] })
  })

  test('OK() allows falsy data values', async () => {
    expect(await LykosReply().OK(0).json()).toBe(0)
    expect(await LykosReply().OK(null).json()).toBeNull()
    expect(await LykosReply().OK('').json()).toBe('')
  })

  test('Created() has a default body', async () => {
    const res = LykosReply().Created()

    expect(res.status).toBe(StatusCode.Created)
    expect(await res.json()).toEqual({ message: 'Created' })
  })

  test('Accepted() has a default body', async () => {
    const res = LykosReply().Accepted()

    expect(res.status).toBe(StatusCode.Accepted)
    expect(await res.json()).toEqual({ message: 'Accepted' })
  })

  const jsonEmptyDefault = [
    ['NonAuthoritativeInfo', StatusCode.NonAuthoritativeInfo],
    ['PartialContent', StatusCode.PartialContent],
    ['MultiStatus', StatusCode.MultiStatus],
    ['AlreadyReported', StatusCode.AlreadyReported],
    ['IMUsed', StatusCode.IMUsed],
  ] as const

  for (const [name, code] of jsonEmptyDefault) {
    test(`${name}() returns ${code} with {} by default`, async () => {
      const res = LykosReply()[name]()

      expect(res.status).toBe(code)
      expect(await res.json()).toEqual({})
    })

    test(`${name}(data) returns the provided data`, async () => {
      const res = LykosReply()[name]({ x: 1 })

      expect(await res.json()).toEqual({ x: 1 })
    })
  }

  test('NoContent() returns 204 with a null body', async () => {
    const res = LykosReply().NoContent()

    expect(res.status).toBe(StatusCode.NoContent)
    expect(res.body).toBeNull()
    expect(await res.text()).toBe('')
  })

  test('ResetContent() returns 205 with a null body', async () => {
    const res = LykosReply().ResetContent()

    expect(res.status).toBe(StatusCode.ResetContent)
    expect(res.body).toBeNull()
  })

  test('NoContent() keeps custom headers', () => {
    const res = LykosReply().header('X-A', '1').NoContent()

    expect(res.headers.get('X-A')).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// 3xx
// ---------------------------------------------------------------------------

describe('3xx redirection', () => {
  test('MultipleChoices() returns JSON {} by default', async () => {
    const res = LykosReply().MultipleChoices()

    expect(res.status).toBe(StatusCode.MultipleChoices)
    expect(await res.json()).toEqual({})
  })

  test('NotModified() returns 304 with a null body', () => {
    const res = LykosReply().NotModified()

    expect(res.status).toBe(StatusCode.NotModified)
    expect(res.body).toBeNull()
  })

  const redirects = [
    ['MovedPermanently', StatusCode.MovedPermanently],
    ['Found', StatusCode.Found],
    ['SeeOther', StatusCode.SeeOther],
    ['UseProxy', StatusCode.UseProxy],
    ['TemporaryRedirect', StatusCode.TemporaryRedirect],
    ['PermanentRedirect', StatusCode.PermanentRedirect],
  ] as const

  for (const [name, code] of redirects) {
    describe(`${name}()`, () => {
      test(`returns ${code}`, () => {
        const res = LykosReply()[name]('/somewhere')

        expect(res.status).toBe(code)
        expect(res.body).toBeNull()
      })

      test('defaults the location to "/"', () => {
        const res = LykosReply()[name]()

        expect(res.headers.get('Location')).toBe('http://localhost/')
      })

      test('resolves a relative path', () => {
        const res = LykosReply()[name]('/users/1?tab=posts')

        expect(res.headers.get('Location')).toBe('http://localhost/users/1?tab=posts')
      })

      test('keeps an absolute URL as is', () => {
        const res = LykosReply()[name]('https://example.com/path')

        expect(res.headers.get('Location')).toBe('https://example.com/path')
      })

      test('keeps custom headers and appends Location', () => {
        const res = LykosReply().header('X-A', '1')[name]('/next')

        expect(res.headers.get('X-A')).toBe('1')
        expect(res.headers.get('Location')).toBe('http://localhost/next')
      })
    })
  }

  test('redirects do not mutate the instance headers', () => {
    const reply = LykosReply().header('X-A', '1')

    reply.Found('/a')
    const res = reply.Found('/b')

    expect(res.headers.get('Location')).toBe('http://localhost/b')
  })

  test('redirect with custom headers does not carry the previous Location', () => {
    const reply = LykosReply().header('X-A', '1')

    reply.Found('/first')
    const res = reply.Found('/second')

    expect(res.headers.get('Location')).toBe('http://localhost/second')
  })
})

// ---------------------------------------------------------------------------
// 4xx
// ---------------------------------------------------------------------------

describe('4xx client errors', () => {
  const withDefaultBody = [
    ['BadRequest', StatusCode.BadRequest, { error: 'Bad Request' }],
    ['Unauthorized', StatusCode.Unauthorized, { error: 'Unauthorized' }],
    ['Forbidden', StatusCode.Forbidden, { error: 'Forbidden' }],
    ['NotFound', StatusCode.NotFound, { error: 'Not Found' }],
    ['ImATeapot', StatusCode.ImATeapot, { message: "I'm a teapot" }],
  ] as const

  for (const [name, code, body] of withDefaultBody) {
    test(`${name}() returns ${code} with the default body`, async () => {
      const res = LykosReply()[name]()

      expect(res.status).toBe(code)
      expect(await res.json()).toEqual(body)
    })

    test(`${name}(data) returns the provided data`, async () => {
      const res = LykosReply()[name]({ custom: true })

      expect(res.status).toBe(code)
      expect(await res.json()).toEqual({ custom: true })
    })
  }

  const withEmptyBody = [
    ['PaymentRequired', StatusCode.PaymentRequired],
    ['MethodNotAllowed', StatusCode.MethodNotAllowed],
    ['NotAcceptable', StatusCode.NotAcceptable],
    ['ProxyAuthenticationRequired', StatusCode.ProxyAuthenticationRequired],
    ['RequestTimeout', StatusCode.RequestTimeout],
    ['Conflict', StatusCode.Conflict],
    ['Gone', StatusCode.Gone],
    ['LengthRequired', StatusCode.LengthRequired],
    ['PreconditionFailed', StatusCode.PreconditionFailed],
    ['ContentTooLarge', StatusCode.ContentTooLarge],
    ['URITooLong', StatusCode.URITooLong],
    ['UnsupportedMediaType', StatusCode.UnsupportedMediaType],
    ['RangeNotSatisfiable', StatusCode.RangeNotSatisfiable],
    ['ExpectationFailed', StatusCode.ExpectationFailed],
    ['MisdirectedRequest', StatusCode.MisdirectedRequest],
    ['UnprocessableContent', StatusCode.UnprocessableContent],
    ['Locked', StatusCode.Locked],
    ['FailedDependency', StatusCode.FailedDependency],
    ['TooEarly', StatusCode.TooEarly],
    ['UpgradeRequired', StatusCode.UpgradeRequired],
    ['PreconditionRequired', StatusCode.PreconditionRequired],
    ['TooManyRequests', StatusCode.TooManyRequests],
    ['RequestHeaderFieldsTooLarge', StatusCode.RequestHeaderFieldsTooLarge],
    ['UnavailableForLegalReasons', StatusCode.UnavailableForLegalReasons],
  ] as const

  for (const [name, code] of withEmptyBody) {
    test(`${name}() returns ${code} with {} by default`, async () => {
      const res = LykosReply()[name]()

      expect(res.status).toBe(code)
      expect(await res.json()).toEqual({})
    })

    test(`${name}(data) returns the provided data`, async () => {
      const res = LykosReply()[name]({ reason: 'x' })

      expect(await res.json()).toEqual({ reason: 'x' })
    })
  }
})

// ---------------------------------------------------------------------------
// 5xx
// ---------------------------------------------------------------------------

describe('5xx server errors', () => {
  test('InternalServerError() has a default body', async () => {
    const res = LykosReply().InternalServerError()

    expect(res.status).toBe(StatusCode.InternalServerError)
    expect(await res.json()).toEqual({ error: 'Internal Server Error' })
  })

  test('InternalServerError(data) uses the provided data', async () => {
    const res = LykosReply().InternalServerError({ error: 'boom' })

    expect(await res.json()).toEqual({ error: 'boom' })
  })

  const withEmptyBody = [
    ['NotImplemented', StatusCode.NotImplemented],
    ['BadGateway', StatusCode.BadGateway],
    ['ServiceUnavailable', StatusCode.ServiceUnavailable],
    ['GatewayTimeout', StatusCode.GatewayTimeout],
    ['HTTPVersionNotSupported', StatusCode.HTTPVersionNotSupported],
    ['VariantAlsoNegotiates', StatusCode.VariantAlsoNegotiates],
    ['InsufficientStorage', StatusCode.InsufficientStorage],
    ['LoopDetected', StatusCode.LoopDetected],
    ['NotExtended', StatusCode.NotExtended],
    ['NetworkAuthenticationRequired', StatusCode.NetworkAuthenticationRequired],
  ] as const

  for (const [name, code] of withEmptyBody) {
    test(`${name}() returns ${code} with {} by default`, async () => {
      const res = LykosReply()[name]()

      expect(res.status).toBe(code)
      expect(await res.json()).toEqual({})
    })

    test(`${name}(data) returns the provided data`, async () => {
      const res = LykosReply()[name]({ reason: 'x' })

      expect(await res.json()).toEqual({ reason: 'x' })
    })
  }
})

// ---------------------------------------------------------------------------
// Interaction between members
// ---------------------------------------------------------------------------

describe('interactions', () => {
  test('shortcut methods ignore status() and use their own code', () => {
    const res = LykosReply().status(500).NotFound()

    expect(res.status).toBe(StatusCode.NotFound)
  })

  test('shortcut methods apply custom headers', () => {
    const res = LykosReply().header('X-Request-Id', 'abc').Created({ id: 1 })

    expect(res.status).toBe(StatusCode.Created)
    expect(res.headers.get('X-Request-Id')).toBe('abc')
  })

  test('the same instance can produce multiple responses', async () => {
    const reply = LykosReply().header('X-A', '1')

    const first = reply.OK({ n: 1 })
    const second = reply.NotFound({ n: 2 })

    expect(first.status).toBe(200)
    expect(second.status).toBe(404)
    expect(await first.json()).toEqual({ n: 1 })
    expect(await second.json()).toEqual({ n: 2 })
    expect(first.headers.get('X-A')).toBe('1')
    expect(second.headers.get('X-A')).toBe('1')
  })

  test('every call returns a new Response', () => {
    const reply = LykosReply()

    expect(reply.OK()).not.toBe(reply.OK())
  })

  test('each LykosReply() call returns an independent instance', () => {
    const a = LykosReply().status(404)
    const b = LykosReply()

    expect(a).not.toBe(b)
    expect(b.send('x').status).toBe(200)
  })
})

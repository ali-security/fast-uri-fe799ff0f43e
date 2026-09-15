'use strict'

const test = require('tape')
const fastURI = require('..')

test('parse marks malformed authority and port inputs as errors', (t) => {
  const malformedCases = [
    {
      input: 'http://[::1]foo',
      expectedError: 'URI path must start with "/" when authority is present.'
    },
    {
      input: 'http://[::1]:80abc/path',
      expectedError: 'URI path must start with "/" when authority is present.'
    },
    {
      input: 'http://example.com:80abc/path',
      expectedError: 'URI path must start with "/" when authority is present.'
    },
    {
      input: 'http://[::1]:65536',
      expectedError: 'URI port is malformed.'
    }
  ]

  t.plan(malformedCases.length)

  malformedCases.forEach(({ input, expectedError }) => {
    t.equal(fastURI.parse(input).error, expectedError, input)
  })
})

test('normalize does not canonicalize malformed URLs into different valid URLs', (t) => {
  const malformedCases = [
    'http://[::1]foo',
    'http://[::1]:80abc/path',
    'http://example.com:80abc/path',
    'http://[::1]:65536'
  ]

  t.plan(malformedCases.length)

  malformedCases.forEach((input) => {
    t.equal(fastURI.normalize(input), input, input)
  })
})

test('equal returns false when either side is malformed', (t) => {
  const malformedPairs = [
    ['http://[::1]foo', 'http://[::1]/foo'],
    ['http://[::1]:80abc/path', 'http://[::1]/abc/path'],
    ['http://example.com:80abc/path', 'http://example.com/abc/path'],
    ['http://[::1]:65536', 'http://[::1]:65536/']
  ]

  t.plan(malformedPairs.length)

  malformedPairs.forEach(([left, right]) => {
    t.equal(fastURI.equal(left, right), false, `${left} != ${right}`)
  })
})

test('normalize preserves encoded authority delimiters in host', (t) => {
  const cases = [
    ['http://trusted.com%40evil.com/', 'http://trusted.com%40evil.com/'],
    ['http://example.com%3A8080/', 'http://example.com%3A8080/'],
    ['http://example.com%2Fevil.com/path', 'http://example.com%2Fevil.com/path'],
    ['http://example.com%23fragment/path', 'http://example.com%23fragment/path'],
    ['http://example.com%3Fq=evil/path', 'http://example.com%3Fq=evil/path'],
    ['http://user%3Apass%40evil.com/', 'http://user%3Apass%40evil.com/'],
    ['http://user@trusted.com%40evil.com/', 'http://user@trusted.com%40evil.com/'],
    ['https://trusted.com%40evil.com/', 'https://trusted.com%40evil.com/'],
    ['ws://trusted.com%40evil.com/chat', 'ws://trusted.com%40evil.com/chat'],
    ['wss://trusted.com%40evil.com/chat', 'wss://trusted.com%40evil.com/chat']
  ]

  t.plan(cases.length)

  cases.forEach(([input, expected]) => {
    t.equal(fastURI.normalize(input), expected, input)
  })
})

test('parse preserves encoded authority delimiters in host', (t) => {
  const cases = [
    ['http://trusted.com%40evil.com/', 'trusted.com%40evil.com'],
    ['http://example.com%3A8080/', 'example.com%3A8080'],
    ['http://user%3Apass%40evil.com/', 'user%3Apass%40evil.com']
  ]

  t.plan(cases.length)

  cases.forEach(([input, expectedHost]) => {
    t.equal(fastURI.parse(input).host, expectedHost, input)
  })
})

test('equal returns false when encoded delimiters differ from live delimiters', (t) => {
  const pairs = [
    ['http://trusted.com%40evil.com/', 'http://trusted.com@evil.com/'],
    ['http://example.com%3A8080/', 'http://example.com:8080/']
  ]

  t.plan(pairs.length)

  pairs.forEach(([left, right]) => {
    t.equal(fastURI.equal(left, right, {}), false, `${left} != ${right}`)
  })
})

test('resolve preserves encoded authority delimiters', (t) => {
  const result = fastURI.resolve('http://base.com/', '//trusted.com%40evil.com/path')
  const parsed = fastURI.parse(result)

  t.plan(1)
  t.notEqual(parsed.host, 'evil.com', '//trusted.com%40evil.com/path')
})

test('serialize escapes authority delimiters in host field', (t) => {
  const result = fastURI.serialize({ scheme: 'http', host: 'trusted.com@evil.com', path: '/' })
  const parsed = fastURI.parse(result)

  t.plan(1)
  t.notEqual(parsed.host, 'evil.com', 'host: trusted.com@evil.com')
})

test('normalize does not double-decode %2540 into a live @', (t) => {
  const result = fastURI.normalize('http://trusted.com%2540evil.com/')
  const parsed = fastURI.parse(result)

  t.plan(1)
  t.notEqual(parsed.host, 'trusted.com@evil.com', 'http://trusted.com%2540evil.com/')
})

test('parse canonicalises IDN / Unicode hosts to their ASCII form', (t) => {
  const cases = [
    {
      input: 'http://127。0。0。1/',
      expectedHost: '127.0.0.1',
      description: 'full-width ideographic stops as octet separators'
    },
    {
      input: 'http://ｅxample.com/',
      expectedHost: 'example.com',
      description: 'fullwidth e as first letter'
    },
    {
      input: 'http://納豆.example.org/',
      expectedHost: 'xn--99zt52a.example.org',
      description: 'CJK label requiring punycode'
    }
  ]

  t.plan(cases.length * 2)

  cases.forEach(({ input, expectedHost, description }) => {
    const parsed = fastURI.parse(input)
    t.notOk(parsed.error, `parse should not set error: ${description}`)
    t.equal(parsed.host, expectedHost, `host canonicalised to ASCII: ${description}`)
  })
})

test('parse canonicalises every Unicode full stop variant used as a label separator', (t) => {
  const cases = [
    ['http://127。0。0。1/', '127.0.0.1', 'U+3002 ideographic full stop'],
    ['http://127．0．0．1/', '127.0.0.1', 'U+FF0E fullwidth full stop'],
    ['http://127｡0｡0｡1/', '127.0.0.1', 'U+FF61 halfwidth ideographic full stop'],
    ['http://example。com/', 'example.com', 'U+3002 separating a registrable domain'],
    ['http://ＥＸＡＭＰＬＥ.com/', 'example.com', 'fullwidth uppercase letters'],
    ['http://納豆.example.org/', 'xn--99zt52a.example.org', 'CJK label requiring punycode']
  ]

  t.plan(cases.length * 2)

  cases.forEach(([input, expectedHost, description]) => {
    const parsed = fastURI.parse(input)
    t.notOk(parsed.error, `parse should not set error: ${description}`)
    t.equal(parsed.host, expectedHost, `host canonicalised to ASCII: ${description}`)
  })
})

test('parse canonicalises non-dotted-decimal IPv4 hosts a client would resolve to loopback', (t) => {
  const cases = [
    ['http://0x7f.0.0.1/', '127.0.0.1', 'hexadecimal first octet'],
    ['http://2130706433/', '127.0.0.1', 'decimal integer address'],
    ['http://0177.0.0.1/', '127.0.0.1', 'octal first octet'],
    ['http://127.1/', '127.0.0.1', 'shorthand two-part address']
  ]

  t.plan(cases.length * 2)

  cases.forEach(([input, expectedHost, description]) => {
    const parsed = fastURI.parse(input)
    t.notOk(parsed.error, `parse should not set error: ${description}`)
    t.equal(parsed.host, expectedHost, `host canonicalised to loopback: ${description}`)
  })
})

test('parse host never desynchronises from the WHATWG URL parser a client would use', (t) => {
  const cases = [
    'http://127。0。0。1/',
    'http://ｅxample.com/',
    'http://納豆.example.org/',
    'https://127。0。0。1/',
    'ws://ｅxample.com/chat',
    'wss://納豆.example.org/chat',
    'http://0x7f.0.0.1/',
    'http://2130706433/'
  ]

  t.plan(cases.length)

  cases.forEach((input) => {
    t.equal(fastURI.parse(input).host, new URL(input).hostname, input)
  })
})

test('normalize canonicalises Unicode hosts so host-based policy checks cannot be bypassed', (t) => {
  const cases = [
    ['http://127。0。0。1/', 'http://127.0.0.1/'],
    ['https://127。0。0。1/admin', 'https://127.0.0.1/admin'],
    ['http://ｅxample.com/', 'http://example.com/'],
    ['http://納豆.example.org/', 'http://xn--99zt52a.example.org/']
  ]

  t.plan(cases.length)

  cases.forEach(([input, expected]) => {
    t.equal(fastURI.normalize(input), expected, input)
  })
})

test('equal treats a Unicode host and its ASCII form as the same origin', (t) => {
  const pairs = [
    ['http://127。0。0。1/', 'http://127.0.0.1/'],
    ['http://ｅxample.com/', 'http://example.com/'],
    ['http://納豆.example.org/', 'http://xn--99zt52a.example.org/']
  ]

  t.plan(pairs.length)

  pairs.forEach(([left, right]) => {
    t.equal(fastURI.equal(left, right, {}), true, `${left} == ${right}`)
  })
})

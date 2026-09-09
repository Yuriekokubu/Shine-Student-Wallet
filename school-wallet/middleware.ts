import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // เฉพาะเส้นทาง /admin เท่านั้นที่ต้องตรวจสอบสิทธิ์ Admin (ยกเว้น /admin/login)
  const isAdminRoute =
    pathname === '/admin' ||
    (pathname.startsWith('/admin/') && pathname !== '/admin/login')

  if (!isAdminRoute) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL('/admin/login?error=config', request.url),
    )
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    const redirectRes = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c)
    })
    return redirectRes
  }

  const role = user.app_metadata?.role || user.user_metadata?.role

  if (role !== 'admin') {
    const redirectRes = NextResponse.redirect(
      new URL('/admin/login?error=not_admin', request.url),
    )
    response.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c)
    })
    return redirectRes
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}


import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (process.env.DEV_MODE === 'true' || !process.env.API_TOKEN) {
        console.log("AuthGuard: DEV_MODE is true or API_TOKEN is not set, allowing all requests")
        return true
    }
    const request = context.switchToHttp().getRequest()
    console.log("AuthGuard: Checking authorization for request to " + request.url)
    const token = this.extractTokenFromHeader(request)
    if (!token || token !== process.env.API_TOKEN) {
        console.log("AuthGuard: Unauthorized request. Provided token: " + token)
        return false
    }

    return true
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

}

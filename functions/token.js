import { parse } from 'cookie';
let env;

function jsonResponse(json) {
  return new Response(JSON.stringify(json), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}

async function getRefreshTokenFromDb(sessionId) {
  env.CRIB_DB;
  /*
      if ($conn->connect_error) {
      error_log($conn->connect_error);
      throw new Exception('DB connection failed - see error logs');
    }   
    $sql = "SELECT * FROM users WHERE session_id = '" . $session_id . "';";
    $result = $conn->query($sql);
    while($row = $result->fetch_assoc()) {
      $user_id = $row["user_id"];
      $email = $row["email"];
      $name = $row["name"];
      $refresh_token = $row["refresh_token"];
    }

    if(isset($refresh_token)) {
      $_SESSION['user_id'] = $user_id;
      $_SESSION['email'] = $email;
      $_SESSION['name'] = $name;
      return $refresh_token;
    } else {
      return false;
    }
  */
}

export async function onRequest(context) {
  env = context.env;

  const cookie = parse(context.request.headers.get('Cookie') || '');

  if (!cookie.cribmember) {
    console.log('Cookie not set');
    return jsonResponse({ access_token: false, no_cookie: true });
  } else {
    console.log('cookie set lets try the db for the refresh token');
    const refresh_token = await getRefreshTokenFromDb(cookie.cribmember);
  }
}

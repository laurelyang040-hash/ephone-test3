<!DOCTYPE html>
<html>

<head>
<link rel="stylesheet" href="/resources/style.css">
<meta charset="UTF-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=0.5">
<title>Catbox</title>
</head>

<body>

<div class="hometab">
	<a class="homebutton" href="/">Home</a>
</div>

<header>
<div class="welcome">User Login</div>
</header>

<br>
<br>

<div class="notesmall">
Welcome back~
</div>

<br>





<form class="genericform" action="dologin.php" method="post" enctype="multipart/form-data">

	Username: <br> <input class="stylized" type="text" name="username" required> <br> <br>
	Password: <br> <input class="stylized" type="password" name="password" required> <br> <br>
	<br>
    <input type="submit" value="Login" name="submit">
	<br>
	<br>
	<div style="font-size: 16px; font-family: 'Helvetica';">Don't have an account? <a class="linkbutton" href="register.php"> Sign up </a>
		<br> 
		<a class="linkbutton" href="forgotpassword.php">Forgot your password?</a>
	</div>
</form>

<div class="image">
	<script src="resources/pic.js"></script>
</div>

</body>

</html>

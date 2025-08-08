provider "aws" {
  region = "us-east-1"
}

# IAM role for Lambda execution
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "il_test_alb_role" {
  name               = "lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy" "lambda_basic_execution_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.il_test_alb_role.name
  policy_arn = data.aws_iam_policy.lambda_basic_execution_policy.arn
}

data "aws_iam_policy" "lambda_ec2_networking" {
  arn = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
}

resource "aws_iam_role_policy_attachment" "function_networking_connect" {
  role       = aws_iam_role.il_test_alb_role.name
  policy_arn = data.aws_iam_policy.lambda_ec2_networking.arn
}

# Package the Lambda function code
data "archive_file" "il_test_alb_archive" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# Lambda function
resource "aws_lambda_function" "il_test_alb_function" {
  filename         = data.archive_file.il_test_alb_archive.output_path
  function_name    = "il_test_alb_lambda_function"
  role             = aws_iam_role.il_test_alb_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.il_test_alb_archive.output_base64sha256

  runtime = "nodejs20.x"

  vpc_config {
    subnet_ids = slice(data.aws_subnets.default_vpc_subnets.ids, 0, 2)
    security_group_ids = data.aws_security_groups.default_sg.ids
  }

  environment {
    variables = {
      ENVIRONMENT = "sandbox"
      LOG_LEVEL   = "info"
    }
  }

  tags = {
    Environment = "sandbox"
    Application = "itty-lambda-test-url"
  }
}

resource "aws_vpc_security_group_ingress_rule" "allow_http_from_lb" {
  security_group_id = data.aws_security_groups.default_sg.ids[0]
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}

# default vpc, subnets and security groups
data "aws_vpc" "default_vpc" {
  default = true
}
data "aws_subnets" "default_vpc_subnets" {
  filter {
    name   = "vpc-id"
    values = [ data.aws_vpc.default_vpc.id ]
  }
}
data "aws_security_groups" "default_sg" {
  filter {
    name   = "vpc-id"
    values = [ data.aws_vpc.default_vpc.id ]
  }

  filter {
    name   = "group-name"
    values = ["default"]
  }
}

# App Load Balancer
resource "aws_lb" "il_test_alb_balancer" {
  name               = "lambda-load-balancer"
  internal           = false
  load_balancer_type = "application"
  subnets            = slice(data.aws_subnets.default_vpc_subnets.ids, 0, 2)
  security_groups    = [aws_security_group.il_test_alb_fe_sg.id]
}

resource "aws_security_group" "il_test_alb_fe_sg" {
  name = "public_facing_http_sg"
  vpc_id = data.aws_vpc.default_vpc.id

  # allow all inbound TCP traffic on port 90
  ingress {
    from_port        = 80
    to_port          = 80
    protocol         = "TCP"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# lb listener and target group
resource "aws_lb_listener" "il_test_alb_listener" {
  load_balancer_arn = aws_lb.il_test_alb_balancer.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    target_group_arn = aws_lb_target_group.il_test_alb_targetgroup.arn
    type             = "forward"
  }
}
resource "aws_lb_target_group" "il_test_alb_targetgroup" {
  name        = "example-lb-tg"
  target_type = "lambda"
}

# permission for lb to invoke lamdba
resource "aws_lambda_permission" "with_lb" {
  statement_id  = "AllowExecutionFromLb"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.il_test_alb_function.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.il_test_alb_targetgroup.arn
}
resource "aws_lb_target_group_attachment" "lambda-tg-attach" {
  target_group_arn = aws_lb_target_group.il_test_alb_targetgroup.arn
  target_id        = aws_lambda_function.il_test_alb_function.arn
  depends_on       = [aws_lambda_permission.with_lb]
}

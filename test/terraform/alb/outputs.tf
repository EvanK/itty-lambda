output "endpoint_url" {
  value = "http://${aws_lb.il_test_alb_balancer.dns_name}"
}

output "lambda_arn" {
  value = aws_lambda_function.il_test_alb_function.arn
}
